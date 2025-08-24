/**
 * Risk Management Module for Live TWAP Trading
 * 
 * This module provides real-time risk monitoring and automatic safety checks
 * to protect against unexpected market conditions during TWAP execution.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { VWAPEnhancedConfig, CandleData } from './vwapEnhancedTWAP';
import { fetchOrderBook } from '../hyperliquid/orderbook';

export interface RiskLimits {
  maxPriceDeviation: number;    // Max % price move from start
  maxVolumeRatio: number;       // Max order size vs market volume
  maxSlippage: number;          // Max acceptable slippage
  minSpread: number;            // Min bid-ask spread required
  maxOrderValue: number;        // Max USD value per order
  maxTotalExposure: number;     // Max total USD exposure
}

export interface RiskMetrics {
  currentPrice: number;
  startPrice: number;
  priceDeviation: number;
  currentSpread: number;
  marketVolume24h: number;
  orderSizeRatio: number;
  estimatedSlippage: number;
  totalExposure: number;
}

export interface RiskAlert {
  type: 'warning' | 'critical';
  message: string;
  metric: keyof RiskMetrics;
  currentValue: number;
  limit: number;
  timestamp: number;
}

export class RiskManager {
  private alerts: RiskAlert[] = [];
  private isHalted = false;
  private startPrice = 0;

  constructor(
    private config: VWAPEnhancedConfig,
    private limits: RiskLimits,
    private onAlert: (alert: RiskAlert) => void
  ) {}

  initialize(startPrice: number): void {
    this.startPrice = startPrice;
    this.isHalted = false;
    this.alerts = [];
  }

  async checkRiskLimits(
    orderSize: number,
    currentPrice: number,
    executedVolume: number
  ): Promise<{ canProceed: boolean; alerts: RiskAlert[] }> {
    
    const metrics = await this.calculateRiskMetrics(orderSize, currentPrice, executedVolume);
    const newAlerts: RiskAlert[] = [];

    // Check price deviation
    if (Math.abs(metrics.priceDeviation) > this.limits.maxPriceDeviation) {
      const alert: RiskAlert = {
        type: 'critical',
        message: `Price deviation ${metrics.priceDeviation.toFixed(2)}% exceeds limit ${this.limits.maxPriceDeviation}%`,
        metric: 'priceDeviation',
        currentValue: Math.abs(metrics.priceDeviation),
        limit: this.limits.maxPriceDeviation,
        timestamp: Date.now()
      };
      newAlerts.push(alert);
      this.onAlert(alert);
    }

    // Check spread
    if (metrics.currentSpread < this.limits.minSpread) {
      const alert: RiskAlert = {
        type: 'warning',
        message: `Bid-ask spread ${metrics.currentSpread.toFixed(4)} is below minimum ${this.limits.minSpread}`,
        metric: 'currentSpread',
        currentValue: metrics.currentSpread,
        limit: this.limits.minSpread,
        timestamp: Date.now()
      };
      newAlerts.push(alert);
      this.onAlert(alert);
    }

    // Check order size vs market volume
    if (metrics.orderSizeRatio > this.limits.maxVolumeRatio) {
      const alert: RiskAlert = {
        type: 'warning',
        message: `Order size ratio ${(metrics.orderSizeRatio * 100).toFixed(2)}% exceeds ${(this.limits.maxVolumeRatio * 100).toFixed(2)}%`,
        metric: 'orderSizeRatio',
        currentValue: metrics.orderSizeRatio,
        limit: this.limits.maxVolumeRatio,
        timestamp: Date.now()
      };
      newAlerts.push(alert);
      this.onAlert(alert);
    }

    // Check slippage estimate
    if (metrics.estimatedSlippage > this.limits.maxSlippage) {
      const alert: RiskAlert = {
        type: 'critical',
        message: `Estimated slippage ${metrics.estimatedSlippage.toFixed(4)} exceeds limit ${this.limits.maxSlippage}`,
        metric: 'estimatedSlippage',
        currentValue: metrics.estimatedSlippage,
        limit: this.limits.maxSlippage,
        timestamp: Date.now()
      };
      newAlerts.push(alert);
      this.onAlert(alert);
    }

    // Check total exposure
    if (metrics.totalExposure > this.limits.maxTotalExposure) {
      const alert: RiskAlert = {
        type: 'critical',
        message: `Total exposure $${metrics.totalExposure.toFixed(2)} exceeds limit $${this.limits.maxTotalExposure}`,
        metric: 'totalExposure',
        currentValue: metrics.totalExposure,
        limit: this.limits.maxTotalExposure,
        timestamp: Date.now()
      };
      newAlerts.push(alert);
      this.onAlert(alert);
    }

    this.alerts.push(...newAlerts);

    // Determine if we can proceed
    const criticalAlerts = newAlerts.filter(alert => alert.type === 'critical');
    const canProceed = criticalAlerts.length === 0 && !this.isHalted;

    if (criticalAlerts.length > 0) {
      this.isHalted = true;
    }

    return { canProceed, alerts: newAlerts };
  }

  private async calculateRiskMetrics(
    orderSize: number,
    currentPrice: number,
    executedVolume: number
  ): Promise<RiskMetrics> {
    
    // Get orderbook data
    const orderbook = await fetchOrderBook(this.config.asset, false); // Assume mainnet for now
    
    let currentSpread = 0;
    let estimatedSlippage = 0;
    let marketVolume24h = 1000000; // Default fallback
    
    if (orderbook && orderbook.levels) {
      const [bids, asks] = orderbook.levels;
      
      if (bids.length > 0 && asks.length > 0) {
        const bestBid = parseFloat(bids[0].px);
        const bestAsk = parseFloat(asks[0].px);
        currentSpread = (bestAsk - bestBid) / bestBid;
        
        // Estimate slippage by walking through the orderbook
        estimatedSlippage = this.estimateSlippage(orderSize, orderbook, this.config.side);
      }
    }

    const priceDeviation = this.startPrice > 0 
      ? ((currentPrice - this.startPrice) / this.startPrice) * 100 
      : 0;

    const orderValue = orderSize * currentPrice;
    const totalExposure = executedVolume * currentPrice;
    const orderSizeRatio = orderSize / Math.max(marketVolume24h / 1440, 1); // Daily volume / minutes

    return {
      currentPrice,
      startPrice: this.startPrice,
      priceDeviation,
      currentSpread,
      marketVolume24h,
      orderSizeRatio,
      estimatedSlippage,
      totalExposure
    };
  }

  private estimateSlippage(
    orderSize: number,
    orderbook: any,
    side: 'buy' | 'sell'
  ): number {
    if (!orderbook.levels) return 0;

    const [bids, asks] = orderbook.levels;
    const levels = side === 'buy' ? asks : bids;
    
    if (levels.length === 0) return 1; // 100% slippage if no liquidity

    let remainingSize = orderSize;
    let totalCost = 0;
    let firstPrice = parseFloat(levels[0].px);

    for (const level of levels) {
      const price = parseFloat(level.px);
      const size = parseFloat(level.sz);
      
      const sizeToTake = Math.min(remainingSize, size);
      totalCost += sizeToTake * price;
      remainingSize -= sizeToTake;
      
      if (remainingSize <= 0) break;
    }

    if (remainingSize > 0) {
      // Not enough liquidity
      return 1; // 100% slippage
    }

    const averagePrice = totalCost / orderSize;
    return Math.abs(averagePrice - firstPrice) / firstPrice;
  }

  getActiveAlerts(): RiskAlert[] {
    // Return alerts from last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.alerts.filter(alert => alert.timestamp > fiveMinutesAgo);
  }

  isExecutionHalted(): boolean {
    return this.isHalted;
  }

  resumeExecution(): void {
    this.isHalted = false;
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  // Predefined risk profiles
  static getConservativeRiskLimits(): RiskLimits {
    return {
      maxPriceDeviation: 2.0,     // 2% price move
      maxVolumeRatio: 0.01,       // 1% of market volume
      maxSlippage: 0.005,         // 0.5% slippage
      minSpread: 0.0001,          // 0.01% minimum spread
      maxOrderValue: 10000,       // $10k per order
      maxTotalExposure: 100000    // $100k total
    };
  }

  static getAggressiveRiskLimits(): RiskLimits {
    return {
      maxPriceDeviation: 5.0,     // 5% price move
      maxVolumeRatio: 0.05,       // 5% of market volume
      maxSlippage: 0.02,          // 2% slippage
      minSpread: 0.00005,         // 0.005% minimum spread
      maxOrderValue: 50000,       // $50k per order
      maxTotalExposure: 500000    // $500k total
    };
  }

  static getDefaultRiskLimits(): RiskLimits {
    return {
      maxPriceDeviation: 3.0,     // 3% price move
      maxVolumeRatio: 0.02,       // 2% of market volume
      maxSlippage: 0.01,          // 1% slippage
      minSpread: 0.00008,         // 0.008% minimum spread
      maxOrderValue: 25000,       // $25k per order
      maxTotalExposure: 250000    // $250k total
    };
  }
}

export default RiskManager;
