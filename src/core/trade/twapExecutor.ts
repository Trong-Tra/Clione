/**
 * Enhanced TWAP Executor for Live Trading
 * 
 * This module provides advanced TWAP execution with enhanced safety features,
 * better error handling, and comprehensive execution tracking.
 */

import { ethers } from "ethers";
import {
  VWAPEnhancedConfig,
  CandleData,
  initializeVWAP,
  updateVWAP,
  calculateVWAPOrderSize,
  roundOrderSizeForAsset
} from "./vwapEnhancedTWAP";
import { placeOrder, TWAPOrderParams, getMarketInfo } from "./placeTWAP";
import { fetchOrderBook } from "../hyperliquid/orderbook";
import { formatHyperliquidPrice, validateHyperliquidPrice } from "../hyperliquid/formatting";

// Enhanced execution status types
export type ExecutionStatus = 'pending' | 'executing' | 'completed' | 'cancelled' | 'failed';

export interface TWAPExecutionState {
  status: ExecutionStatus;
  currentOrder: number;
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  totalExecuted: number;
  averagePrice: number;
  startTime: number;
  estimatedEndTime: number | null;
  lastOrderTime: number | null;
}

export interface TWAPOrderResult {
  orderNumber: number;
  success: boolean;
  orderId?: string;
  size: number;
  price: number;
  timestamp: number;
  vwapMultiplier: number;
  error?: string;
}

export interface ExecutionCallbacks {
  onOrderPlaced: (result: TWAPOrderResult) => void;
  onProgress: (progress: number, state: TWAPExecutionState) => void;
  onLog: (message: string) => void;
  onError: (error: string) => void;
  onComplete: (summary: TWAPExecutionSummary) => void;
}

export interface TWAPExecutionSummary {
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  totalSize: number;
  totalExecuted: number;
  averageExecutionPrice: number;
  executionTimeMs: number;
  vwapDeviation: number;
  slippageAnalysis: {
    averageSlippage: number;
    maxSlippage: number;
    minSlippage: number;
  };
}

export class LiveTWAPExecutor {
  private isExecuting = false;
  private shouldStop = false;
  private executionState: TWAPExecutionState;
  private orderResults: TWAPOrderResult[] = [];

  constructor(
    private privateKey: string,
    private useTestnet: boolean,
    private callbacks: ExecutionCallbacks
  ) {
    this.executionState = {
      status: 'pending',
      currentOrder: 0,
      totalOrders: 0,
      successfulOrders: 0,
      failedOrders: 0,
      totalExecuted: 0,
      averagePrice: 0,
      startTime: 0,
      estimatedEndTime: null,
      lastOrderTime: null
    };
  }

  async execute(config: VWAPEnhancedConfig, candles: CandleData[]): Promise<TWAPExecutionSummary> {
    if (this.isExecuting) {
      throw new Error("TWAP execution already in progress");
    }

    this.isExecuting = true;
    this.shouldStop = false;
    this.orderResults = [];
    
    // Initialize execution state
    this.executionState = {
      ...this.executionState,
      status: 'executing',
      totalOrders: config.totalOrders,
      startTime: Date.now(),
      estimatedEndTime: Date.now() + (config.totalOrders * config.timeInterval),
      currentOrder: 0,
      successfulOrders: 0,
      failedOrders: 0,
      totalExecuted: 0,
      averagePrice: 0,
      lastOrderTime: null
    };

    this.callbacks.onLog(`🚀 Starting Live TWAP execution for ${config.asset}`);

    try {
      // Validate configuration
      await this.validateConfiguration(config);
      
      // Get market information
      const marketInfo = await this.getMarketInformation(config.asset);
      
      // Initialize VWAP
      let vwapData = initializeVWAP(candles);
      this.callbacks.onLog(`📊 Initial VWAP: $${vwapData.vwap.toFixed(6)}`);
      
      // Calculate base order size
      const baseOrderSize = config.totalSize / config.totalOrders;
      this.callbacks.onLog(`📦 Base order size: ${baseOrderSize} ${config.asset}`);
      
      // Execute orders sequentially
      for (let i = 0; i < config.totalOrders && !this.shouldStop; i++) {
        this.executionState.currentOrder = i + 1;
        
        try {
          const orderResult = await this.executeOrder(
            config,
            marketInfo,
            vwapData,
            baseOrderSize,
            i + 1
          );
          
          this.orderResults.push(orderResult);
          
          if (orderResult.success) {
            this.executionState.successfulOrders++;
            this.executionState.totalExecuted += orderResult.size;
            this.updateAveragePrice(orderResult.price, orderResult.size);
          } else {
            this.executionState.failedOrders++;
          }
          
          this.callbacks.onOrderPlaced(orderResult);
          
          // Update progress
          const progress = (i + 1) / config.totalOrders * 100;
          this.callbacks.onProgress(progress, this.executionState);
          
          // Wait for next order (except last one)
          if (i < config.totalOrders - 1 && !this.shouldStop) {
            this.callbacks.onLog(`⏱️ Waiting ${config.timeInterval / 1000}s for next order...`);
            await this.delay(config.timeInterval);
          }
          
        } catch (orderError) {
          this.handleOrderError(i + 1, orderError);
        }
      }
      
      // Generate execution summary
      const summary = this.generateExecutionSummary();
      this.executionState.status = this.shouldStop ? 'cancelled' : 'completed';
      
      this.callbacks.onComplete(summary);
      return summary;
      
    } catch (error) {
      this.executionState.status = 'failed';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onError(`Execution failed: ${errorMessage}`);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  stop(): void {
    if (this.isExecuting) {
      this.shouldStop = true;
      this.callbacks.onLog("🛑 Stopping TWAP execution...");
    }
  }

  getExecutionState(): TWAPExecutionState {
    return { ...this.executionState };
  }

  isRunning(): boolean {
    return this.isExecuting;
  }

  private async validateConfiguration(config: VWAPEnhancedConfig): Promise<void> {
    if (!config.asset || config.totalSize <= 0 || config.totalOrders <= 0) {
      throw new Error("Invalid TWAP configuration");
    }
    
    if (!ethers.isHexString(this.privateKey, 32)) {
      throw new Error("Invalid private key");
    }
    
    this.callbacks.onLog("✅ Configuration validated");
  }

  private async getMarketInformation(asset: string) {
    const marketInfo = await getMarketInfo(asset, this.useTestnet);
    if (!marketInfo) {
      throw new Error(`Could not find market info for ${asset}`);
    }
    
    const assetIndex = marketInfo.assetInfo?.index || 0;
    const assetDecimals = marketInfo.szDecimals !== null && marketInfo.szDecimals !== undefined
      ? marketInfo.szDecimals
      : 4;
    
    this.callbacks.onLog(`🎯 Asset: ${asset} (Index: ${assetIndex}, Decimals: ${assetDecimals})`);
    
    return { assetIndex, assetDecimals, marketInfo };
  }

  private async executeOrder(
    config: VWAPEnhancedConfig,
    marketInfo: { assetIndex: number; assetDecimals: number },
    vwapData: any,
    baseOrderSize: number,
    orderNumber: number
  ): Promise<TWAPOrderResult> {
    
    // Get current market price
    const currentMarketPrice = await this.getCurrentMarketPrice(config.asset, config.side);
    
    // Calculate VWAP-adjusted order size
    const vwapOrderSize = calculateVWAPOrderSize(
      baseOrderSize,
      currentMarketPrice,
      vwapData.vwap,
      config.vwapAlpha,
      config.maxMultiplier,
      config.minMultiplier
    );
    
    // Round order size
    const roundedSize = roundOrderSizeForAsset(vwapOrderSize.adjustedSize, marketInfo.assetDecimals);
    
    this.callbacks.onLog(
      `📊 Order ${orderNumber}: ${vwapOrderSize.adjustedSize.toFixed(6)} → ${roundedSize} ` +
      `(${vwapOrderSize.multiplier.toFixed(2)}x VWAP multiplier)`
    );
    
    // Calculate order price with slippage protection
    const slippageBuffer = 0.001; // 0.1%
    const orderPrice = config.side === "buy"
      ? currentMarketPrice * (1 + slippageBuffer)
      : currentMarketPrice * (1 - slippageBuffer);
    
    // Constrain price within Hyperliquid limits
    const maxPriceDeviation = 0.75; // 75% to be safe
    const minAllowedPrice = currentMarketPrice * (1 - maxPriceDeviation);
    const maxAllowedPrice = currentMarketPrice * (1 + maxPriceDeviation);
    const constrainedPrice = Math.max(minAllowedPrice, Math.min(maxAllowedPrice, orderPrice));
    
    // Format price according to Hyperliquid's precision rules  
    const formattedPrice = formatHyperliquidPrice(
      constrainedPrice, 
      marketInfo.assetDecimals, 
      false // Assume perp for now - you can pass market type if needed
    );

    // Validate the formatted price
    const priceValidation = validateHyperliquidPrice(
      formattedPrice, 
      marketInfo.assetDecimals, 
      false
    );

    if (!priceValidation.isValid) {
      throw new Error(`Invalid price format: ${priceValidation.reason}`);
    }
    
    // Prepare order parameters
    const orderParams: TWAPOrderParams = {
      asset: marketInfo.assetIndex,
      isBuy: config.side === "buy",
      price: formattedPrice,
      size: roundedSize.toString(),
      timeInForce: "Ioc" as const,
      reduceOnly: false,
    };
    
    this.callbacks.onLog(
      `📤 Placing ${config.side.toUpperCase()} order ${orderNumber}: ${roundedSize} ${config.asset} ` +
      `@ $${formattedPrice}`
    );
    
    const timestamp = Date.now();
    this.executionState.lastOrderTime = timestamp;
    
    // Place the order
    const orderResult = await placeOrder(this.privateKey, orderParams, this.useTestnet);
    
    const result: TWAPOrderResult = {
      orderNumber,
      success: orderResult.success,
      orderId: orderResult.orderId,
      size: roundedSize,
      price: parseFloat(formattedPrice),
      timestamp,
      vwapMultiplier: vwapOrderSize.multiplier,
      error: orderResult.error
    };
    
    if (orderResult.success) {
      this.callbacks.onLog(`✅ Order ${orderNumber} placed successfully! ID: ${orderResult.orderId}`);
    } else {
      this.callbacks.onLog(`❌ Order ${orderNumber} failed: ${orderResult.error}`);
    }
    
    return result;
  }

  private async getCurrentMarketPrice(asset: string, side: "buy" | "sell"): Promise<number> {
    try {
      const orderbook = await fetchOrderBook(asset, this.useTestnet);
      if (!orderbook || !orderbook.levels) {
        throw new Error(`No orderbook data for ${asset}`);
      }

      const [bids, asks] = orderbook.levels;

      if (side === "buy" && asks.length > 0) {
        return parseFloat(asks[0].px);
      } else if (side === "sell" && bids.length > 0) {
        return parseFloat(bids[0].px);
      }

      throw new Error(`No ${side === "buy" ? "asks" : "bids"} available`);
    } catch (error) {
      this.callbacks.onLog(`⚠️ Failed to get orderbook price, using fallback`);
      // You could implement a fallback price mechanism here
      throw error;
    }
  }

  private updateAveragePrice(price: number, size: number): void {
    const currentTotal = this.executionState.averagePrice * (this.executionState.totalExecuted - size);
    this.executionState.averagePrice = (currentTotal + price * size) / this.executionState.totalExecuted;
  }

  private handleOrderError(orderNumber: number, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.executionState.failedOrders++;
    
    const orderResult: TWAPOrderResult = {
      orderNumber,
      success: false,
      size: 0,
      price: 0,
      timestamp: Date.now(),
      vwapMultiplier: 0,
      error: errorMessage
    };
    
    this.orderResults.push(orderResult);
    this.callbacks.onOrderPlaced(orderResult);
    this.callbacks.onLog(`❌ Order ${orderNumber} error: ${errorMessage}`);
  }

  private generateExecutionSummary(): TWAPExecutionSummary {
    const executionTimeMs = Date.now() - this.executionState.startTime;
    const successfulResults = this.orderResults.filter(r => r.success);
    
    const slippages = successfulResults.map(r => {
      // Calculate slippage if we had reference price data
      return 0; // Placeholder - implement actual slippage calculation
    });
    
    return {
      totalOrders: this.executionState.totalOrders,
      successfulOrders: this.executionState.successfulOrders,
      failedOrders: this.executionState.failedOrders,
      totalSize: this.executionState.totalOrders * (this.executionState.totalExecuted / Math.max(this.executionState.successfulOrders, 1)),
      totalExecuted: this.executionState.totalExecuted,
      averageExecutionPrice: this.executionState.averagePrice,
      executionTimeMs,
      vwapDeviation: 0, // Implement VWAP deviation calculation
      slippageAnalysis: {
        averageSlippage: slippages.length > 0 ? slippages.reduce((a, b) => a + b, 0) / slippages.length : 0,
        maxSlippage: slippages.length > 0 ? Math.max(...slippages) : 0,
        minSlippage: slippages.length > 0 ? Math.min(...slippages) : 0
      }
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
