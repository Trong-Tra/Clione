/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * VWAP-Enhanced TWAP Algorithm
 * 
 * A sophisticated TWAP implementation that uses VWAP indicator for dynamic volume sizing.
 * The algorithm adjusts order volumes based on price deviation from VWAP to achieve
 * better execution prices than traditional fixed-size TWAP strategies.
 * 
 * Core Principle: When price is below VWAP, increase volume (favorable conditions)
 *                When price is above VWAP, decrease volume (unfavorable conditions)
 */

import { TWAPConfig, getMarketInfo } from "./placeTWAP";
import { 
  fetchOrderBook, 
  calculateSlippage, 
  checkVolumeConstraints,
  OrderBook,
  SlippageInfo 
} from "../hyperliquid/orderbook";

// Types for VWAP-enhanced TWAP
export interface VWAPEnhancedConfig {
  // Base TWAP config
  totalSize: number;           // Total shares to execute
  totalOrders: number;         // Number of orders to split into
  timeInterval: number;        // Interval between orders (ms)
  maxSlippagePercent: number;  // Maximum acceptable slippage
  
  // VWAP-specific config
  vwapAlpha: number;           // VWAP sensitivity factor (0.1 - 1.0)
  maxMultiplier: number;       // Maximum volume multiplier (default: 5x)
  minMultiplier: number;       // Minimum volume multiplier (default: 0.1x)
  vwapPeriod: number;          // Number of candles for VWAP calculation
  
  // Trading config
  asset: string;               // Asset symbol
  side: 'buy' | 'sell';        // Order side
}

export interface VWAPData {
  vwap: number;
  cumulativePV: number;        // Cumulative Price * Volume
  cumulativeVolume: number;    // Cumulative Volume
  lastUpdated: number;         // Timestamp of last update
}

export interface VWAPOrderSizing {
  baseSize: number;           // Original order size
  adjustedSize: number;       // VWAP-adjusted size
  multiplier: number;         // Applied multiplier
  priceDeviation: number;     // Price deviation from VWAP (%)
  reasoning: string;          // Human-readable explanation
}

export interface SlippageProtectedOrder {
  requestedSize: number;      // Original requested size
  executedSize: number;       // Actual executed size after slippage protection
  remainingSize: number;      // Size that couldn't be executed
  slippageInfo: SlippageInfo; // Detailed slippage analysis
  orderBook: OrderBook | null; // Orderbook snapshot used
  reason: string;             // Explanation of size adjustment
}

export interface CandleData {
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface VWAPSimulationResult {
  orderId: string;
  timestamp: string;
  shares: number;
  price: number;
  vwap: number;
  multiplier: number;
  slippage: number;
  status: 'executed' | 'rejected' | 'partial';
  reasoning: string;
}

/**
 * Initialize VWAP calculation from historical candle data
 * Uses HLC3 and Session-based anchoring to match Hyperliquid exactly
 * VWAP = Sum(HLC3 * Volume) / Sum(Volume) from session start
 */
export function initializeVWAP(candles: CandleData[]): VWAPData {
  if (!candles || candles.length === 0) {
    return { vwap: 0, cumulativePV: 0, cumulativeVolume: 0, lastUpdated: Date.now() };
  }
  
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  
  console.log(`🔍 VWAP Debug - Processing ${candles.length} candles (HLC3 Session-based to match Hyperliquid)`);
  
  candles.forEach((candle, index) => {
    if (candle && typeof candle.high === 'number' && typeof candle.low === 'number' && 
        typeof candle.close === 'number' && typeof candle.volume === 'number' && 
        candle.high > 0 && candle.low > 0 && candle.close > 0 && candle.volume > 0) {
      
      // Use HLC3 exactly as Hyperliquid does: (High + Low + Close) / 3
      const hlc3 = (candle.high + candle.low + candle.close) / 3;
      const pv = hlc3 * candle.volume;
      
      cumulativePV += pv;
      cumulativeVolume += candle.volume;
      
      if (index < 3 || index >= candles.length - 3) {
        const currentVWAP = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : 0;
        console.log(`🔍 Candle ${index}: H=${candle.high.toFixed(6)}, L=${candle.low.toFixed(6)}, C=${candle.close.toFixed(6)}, HLC3=${hlc3.toFixed(6)}, V=${candle.volume.toFixed(2)}, VWAP=${currentVWAP.toFixed(6)}`);
      }
    } else {
      console.warn(`🔍 Invalid candle at index ${index}:`, candle);
    }
  });
  
  const vwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : 0;
  console.log(`🔍 Final HLC3 Session VWAP: ${vwap.toFixed(6)} (TotalPV=${cumulativePV.toFixed(2)}, TotalVol=${cumulativeVolume.toFixed(2)})`);
  
  // Sanity check: VWAP should be within reasonable range of HLC3 prices
  const hlc3Prices = candles.map(c => (c.high + c.low + c.close) / 3);
  const minPrice = Math.min(...hlc3Prices);
  const maxPrice = Math.max(...hlc3Prices);
  const avgHLC3 = hlc3Prices.reduce((sum, p) => sum + p, 0) / hlc3Prices.length;
  
  console.log(`🔍 Sanity Check - VWAP: ${vwap.toFixed(6)}, Avg HLC3: ${avgHLC3.toFixed(6)}, Range: ${minPrice.toFixed(6)} - ${maxPrice.toFixed(6)}`);
  
  return { 
    vwap: isNaN(vwap) || vwap <= 0 ? avgHLC3 : vwap, 
    cumulativePV, 
    cumulativeVolume, 
    lastUpdated: Date.now() 
  };
}

/**
 * Update VWAP with new candle data (incremental calculation)
 * Uses HLC3 to match Hyperliquid exactly
 */
export function updateVWAP(vwapData: VWAPData, newCandle: CandleData): VWAPData {
  if (!newCandle || !vwapData) return vwapData;
  
  // Use HLC3 exactly as Hyperliquid does
  const hlc3 = (newCandle.high + newCandle.low + newCandle.close) / 3;
  const pv = hlc3 * newCandle.volume;
  const newCumulativePV = vwapData.cumulativePV + pv;
  const newCumulativeVolume = vwapData.cumulativeVolume + newCandle.volume;
  
  const newVWAP = newCumulativeVolume > 0 ? newCumulativePV / newCumulativeVolume : vwapData.vwap;
  
  console.log(`📈 VWAP Update: HLC3=${hlc3.toFixed(6)}, Vol=${newCandle.volume.toFixed(2)}, New VWAP=${newVWAP.toFixed(6)}`);
  
  return {
    vwap: isNaN(newVWAP) ? vwapData.vwap : newVWAP,
    cumulativePV: newCumulativePV,
    cumulativeVolume: newCumulativeVolume,
    lastUpdated: Date.now()
  };
}

/**
 * Reset VWAP for new session (daily reset)
 * This should be called at session boundaries (e.g., daily reset)
 */
export function resetVWAP(startingCandle?: CandleData): VWAPData {
  if (startingCandle) {
    const hlc3 = (startingCandle.high + startingCandle.low + startingCandle.close) / 3;
    const pv = hlc3 * startingCandle.volume;
    return {
      vwap: hlc3,
      cumulativePV: pv,
      cumulativeVolume: startingCandle.volume,
      lastUpdated: Date.now()
    };
  }
  
  return { vwap: 0, cumulativePV: 0, cumulativeVolume: 0, lastUpdated: Date.now() };
}

/**
 * Calculate VWAP from a rolling window of candles
 * This is more appropriate for trading algorithms as it provides a moving VWAP
 * that reflects recent market conditions rather than session-from-start
 */
export function calculateRollingVWAP(candles: CandleData[], period: number = 20): VWAPData {
  if (!candles || candles.length === 0) {
    return { vwap: 0, cumulativePV: 0, cumulativeVolume: 0, lastUpdated: Date.now() };
  }
  
  // Take the last 'period' candles for rolling window
  const windowCandles = candles.slice(-period);
  
  return initializeVWAP(windowCandles);
}

/**
 * @param baseSize - Original order size from TWAP schedule
 * @param currentPrice - Current market price
 * @param vwap - Current VWAP value
 * @param alpha - Sensitivity factor (0.1 = conservative, 1.0 = aggressive)
 * @param maxMultiplier - Maximum volume multiplier (default: 5x)
 * @param minMultiplier - Minimum volume multiplier (default: 0.1x)
 */
export function calculateVWAPOrderSize(
  baseSize: number, 
  currentPrice: number, 
  vwap: number, 
  alpha: number,
  maxMultiplier: number,
  minMultiplier: number
): VWAPOrderSizing {
  
  // Input validation and sanity checks
  if (!baseSize || !currentPrice || !vwap || currentPrice <= 0 || vwap <= 0) {
    console.warn(`⚠️ Invalid inputs: baseSize=${baseSize}, currentPrice=${currentPrice}, vwap=${vwap}`);
    return {
      baseSize,
      adjustedSize: baseSize || 0,
      multiplier: 1,
      priceDeviation: 0,
      reasoning: "Invalid input data - using base size"
    };
  }
  
  // Calculate price deviation from VWAP
  const priceDeviation = (vwap - currentPrice) / vwap;
  const priceDeviationPercent = priceDeviation * 100;
  
  console.log(`🔍 VWAP Sizing: Price=${currentPrice.toFixed(6)}, VWAP=${vwap.toFixed(6)}, Deviation=${priceDeviationPercent.toFixed(2)}%, Alpha=${alpha}`);
  
  // Apply VWAP-based multiplier (don't cap alpha - let user control it)
  const rawMultiplier = 1 + alpha * priceDeviation;
  
  // Clamp multiplier within bounds
  const multiplier = isNaN(rawMultiplier) ? 1 : Math.max(minMultiplier, Math.min(maxMultiplier, rawMultiplier));
  const adjustedSize = baseSize * multiplier;
  
  // Generate reasoning for the sizing decision
  let reasoning: string;
  if (Math.abs(priceDeviationPercent) < 0.5) {
    reasoning = `Price ≈ VWAP (${priceDeviationPercent.toFixed(2)}%) - neutral sizing`;
  } else if (priceDeviation > 0) {
    reasoning = `Price ${priceDeviationPercent.toFixed(2)}% below VWAP - INCREASED volume (${multiplier.toFixed(3)}x)`;
  } else {
    reasoning = `Price ${Math.abs(priceDeviationPercent).toFixed(2)}% above VWAP - REDUCED volume (${multiplier.toFixed(3)}x)`;
  }
  
  console.log(`🔍 VWAP Result: ${reasoning}, BaseSize=${baseSize.toFixed(2)}, AdjustedSize=${adjustedSize.toFixed(2)}`);
  
  return {
    baseSize,
    adjustedSize: isNaN(adjustedSize) ? baseSize : adjustedSize,
    multiplier,
    priceDeviation: priceDeviationPercent,
    reasoning
  };
}

/**
 * Round order size according to asset decimal requirements
 * PURR has 0 decimals, so sizes must be whole numbers
 * ETH has more decimals, so more precision is allowed
 */
export function roundOrderSizeForAsset(size: number, assetDecimals: number): number {
  const originalSize = size;
  let roundedSize: number;
  
  if (assetDecimals === 0) {
    // For assets like PURR with 0 decimals, round to nearest whole number
    roundedSize = Math.round(size);
  } else {
    // For assets with decimals, round to the specified decimal places
    const multiplier = Math.pow(10, assetDecimals);
    roundedSize = Math.round(size * multiplier) / multiplier;
  }
  
  console.log(`🔧 Asset Rounding: ${originalSize.toFixed(6)} → ${roundedSize} (${assetDecimals} decimals)`);
  return roundedSize;
}

/**
 * Calculate VWAP-enhanced order size with real slippage protection
 */
async function calculateSlippageProtectedOrderSize(
  requestedSize: number,
  asset: string,
  isBuy: boolean,
  maxSlippagePercent: number,
  assetDecimals: number,
  useTestnet: boolean = true
): Promise<SlippageProtectedOrder> {
  try {
    // Fetch real orderbook from Hyperliquid
    const orderBook = await fetchOrderBook(asset, useTestnet);
    
    if (!orderBook) {
      return {
        requestedSize,
        executedSize: 0,
        remainingSize: requestedSize,
        slippageInfo: {
          estimatedPrice: 0,
          slippagePercent: 100,
          depth: 0,
          wouldExecute: false
        },
        orderBook: null,
        reason: "Failed to fetch orderbook data"
      };
    }

    // Check if the requested size can be executed within slippage tolerance
    const volumeConstraints = checkVolumeConstraints(
      orderBook,
      requestedSize,
      isBuy,
      maxSlippagePercent,
      10.0 // Max 10% of market depth
    );

    if (volumeConstraints.canHandle) {
      // Full execution possible
      const slippageInfo = calculateSlippage(orderBook, requestedSize, isBuy);
      return {
        requestedSize,
        executedSize: requestedSize,
        remainingSize: 0,
        slippageInfo,
        orderBook,
        reason: `Full execution within ${slippageInfo.slippagePercent.toFixed(2)}% slippage`
      };
    } else {
      // Partial execution - use suggested max volume
      const maxAllowedSize = volumeConstraints.suggestedMaxVolume || 0;
      const executedSizeBeforeRounding = Math.max(0, Math.min(maxAllowedSize, requestedSize));
      
      // Apply asset decimal rounding to ensure compliance with Hyperliquid order size rules
      const executedSize = roundOrderSizeForAsset(executedSizeBeforeRounding, assetDecimals);
      const remainingSize = requestedSize - executedSize;
      
      console.log(`🛡️ Slippage Protection Rounding: ${executedSizeBeforeRounding.toFixed(6)} → ${executedSize} (${assetDecimals} decimals)`);
      
      const slippageInfo = executedSize > 0 
        ? calculateSlippage(orderBook, executedSize, isBuy)
        : {
            estimatedPrice: 0,
            slippagePercent: 100,
            depth: 0,
            wouldExecute: false
          };

      return {
        requestedSize,
        executedSize,
        remainingSize,
        slippageInfo,
        orderBook,
        reason: volumeConstraints.reason || "Slippage protection applied"
      };
    }
  } catch (error) {
    console.error("Error in slippage protection:", error);
    return {
      requestedSize,
      executedSize: requestedSize * 0.5, // Conservative fallback
      remainingSize: requestedSize * 0.5,
      slippageInfo: {
        estimatedPrice: 0,
        slippagePercent: 50,
        depth: 1,
        wouldExecute: true
      },
      orderBook: null,
      reason: "Fallback execution due to orderbook error"
    };
  }
}

/**
 * Simulate VWAP-Enhanced TWAP execution for backtesting/validation
 * 
 * @param config - VWAP-enhanced TWAP configuration
 * @param marketData - Historical candle data for simulation
 * @returns Array of simulated order results
 */
export async function simulateVWAPEnhancedTWAP(
  config: VWAPEnhancedConfig,
  marketData: CandleData[]
): Promise<VWAPSimulationResult[]> {
  
  if (!marketData || marketData.length === 0) {
    throw new Error("No market data provided for simulation");
  }
  
  // Fetch asset metadata to get decimals for proper order size rounding
  let assetDecimals = 4; // Default fallback
  try {
    const assetInfo = await getMarketInfo(config.asset, true); // Use testnet for simulation
    assetDecimals = assetInfo.szDecimals || 4;
    console.log(`📊 Asset ${config.asset} has ${assetDecimals} decimals for order sizing`);
  } catch (error) {
    console.warn(`⚠️ Could not fetch asset info for ${config.asset}, using default ${assetDecimals} decimals:`, error);
  }
  
  // Initialize VWAP from historical data
  const initialVWAPData = initializeVWAP(marketData.slice(0, config.vwapPeriod));
  let currentVWAPData = initialVWAPData;
  
  const results: VWAPSimulationResult[] = [];
  let remainingShares = config.totalSize;
  let remainingOrders = config.totalOrders;
  let accumulatedRemainder = 0; // Track volume that couldn't be executed
  
  console.log(`🧪 Starting VWAP-Enhanced TWAP Simulation with Real Slippage Protection`);
  console.log(`📊 Initial VWAP: $${currentVWAPData.vwap.toFixed(6)}`);
  console.log(`🛡️ Max Slippage: ${config.maxSlippagePercent}%`);
  
  for (let i = 0; i < config.totalOrders && remainingShares > 0; i++) {
    // Get current market candle (simulate real-time data)
    const currentCandle = marketData[Math.min(i + config.vwapPeriod, marketData.length - 1)];
    if (!currentCandle) break;
    
    // Update VWAP with new market data
    currentVWAPData = updateVWAP(currentVWAPData, currentCandle);
    
    // Calculate base order size (including redistributed volume from previous orders)
    const baseOrderSize = (remainingShares + accumulatedRemainder) / remainingOrders;
    
    // Apply VWAP-enhanced sizing
    const vwapSizing = calculateVWAPOrderSize(
      baseOrderSize,
      currentCandle.close,
      currentVWAPData.vwap,
      config.vwapAlpha,
      config.maxMultiplier,
      config.minMultiplier,
    );
    
    // Ensure we don't exceed remaining shares (including accumulated remainder)
    const requestedSizeBeforeRounding = Math.min(vwapSizing.adjustedSize, remainingShares + accumulatedRemainder);
    
    // Round order size according to asset decimals (crucial for Hyperliquid compliance)
    // PURR has 0 decimals, so sizes must be whole numbers
    const requestedSize = roundOrderSizeForAsset(requestedSizeBeforeRounding, assetDecimals);
    
    console.log(`🔧 Order ${i + 1} Size Rounding: ${requestedSizeBeforeRounding.toFixed(6)} → ${requestedSize} (${assetDecimals} decimals)`);
    
    // Apply real slippage protection using orderbook data
    const slippageProtection = await calculateSlippageProtectedOrderSize(
      requestedSize,
      config.asset,
      config.side === 'buy',
      config.maxSlippagePercent,
      assetDecimals,
      true // useTestnet - should be configurable
    );
    
    const actualSize = slippageProtection.executedSize;
    const newRemainder = slippageProtection.remainingSize;
    
    // Add the new remainder to accumulated remainder for redistribution
    accumulatedRemainder += newRemainder;
    
    // Calculate execution price from slippage info
    const executionPrice = slippageProtection.slippageInfo.wouldExecute 
      ? slippageProtection.slippageInfo.estimatedPrice 
      : currentCandle.close;
    
    const result: VWAPSimulationResult = {
      orderId: `VWAP_${Date.now()}_${i}`,
      timestamp: new Date(currentCandle.timestamp || Date.now()).toISOString(),
      shares: actualSize,
      price: executionPrice,
      vwap: currentVWAPData.vwap,
      multiplier: vwapSizing.multiplier,
      slippage: slippageProtection.slippageInfo.slippagePercent,
      status: actualSize > 0 ? (actualSize === requestedSize ? 'executed' : 'partial') : 'rejected',
      reasoning: `${vwapSizing.reasoning} | ${slippageProtection.reason}`
    };
    
    results.push(result);
    
    // Update remaining quantities
    remainingShares -= actualSize;
    remainingOrders -= 1;
    
    console.log(`📈 Order ${i + 1}: ${actualSize.toFixed(2)} @ $${result.price.toFixed(6)} | VWAP: $${currentVWAPData.vwap.toFixed(6)} | Slippage: ${slippageProtection.slippageInfo.slippagePercent.toFixed(2)}%`);
    console.log(`🔄 Remaining: ${remainingShares.toFixed(2)} shares, ${accumulatedRemainder.toFixed(2)} redistributed`);
  }
  
  // Handle any remaining volume that couldn't be executed
  if (accumulatedRemainder > 0) {
    console.log(`⚠️ Warning: ${accumulatedRemainder.toFixed(2)} shares could not be executed due to slippage constraints`);
  }
  
  console.log(`✅ VWAP-Enhanced TWAP Simulation completed: ${results.length} orders`);
  return results;
}

/**
 * Calculate performance metrics for VWAP-Enhanced TWAP
 */
export function calculateVWAPPerformance(results: VWAPSimulationResult[], originalConfig?: { totalSize: number; totalOrders: number }) {
  // Filter out rejected orders and only include orders that actually executed shares
  const executedOrders = results.filter(r => r.status !== 'rejected' && r.shares > 0);
  
  if (executedOrders.length === 0) {
    return {
      totalExecuted: 0,
      averagePrice: 0,
      averageSlippage: 0,
      vwapPerformance: 0,
      averageMultiplier: 1,
      executionRate: 0,
      vwapEnhancedAvgPrice: 0,
      standardTWAPAvgPrice: 0
    };
  }
  
  const totalExecuted = executedOrders.reduce((sum, r) => sum + r.shares, 0);
  const weightedAvgPrice = executedOrders.reduce((sum, r) => sum + r.price * r.shares, 0) / totalExecuted;
  const avgSlippage = executedOrders.reduce((sum, r) => sum + Math.abs(r.slippage), 0) / executedOrders.length;
  const avgMultiplier = executedOrders.reduce((sum, r) => sum + r.multiplier, 0) / executedOrders.length;
  
  // Calculate VWAP performance using volume-weighted average VWAP
  const weightedAvgVWAP = executedOrders.reduce((sum, r) => sum + r.vwap * r.shares, 0) / totalExecuted;
  
  // VWAP performance: negative means we beat VWAP (better execution)
  const vwapPerformance = weightedAvgVWAP > 0 ? ((weightedAvgPrice - weightedAvgVWAP) / weightedAvgVWAP * 100) : 0;
  
  // VWAP-Enhanced Average Price (our algorithm with dynamic sizing)
  const vwapEnhancedAvgPrice = weightedAvgPrice;
  
  // Standard TWAP Average Price (equal slicing simulation)
  let standardTWAPAvgPrice = 0;
  
  if (originalConfig) {
    // Use the original planned equal slice size
    const equalSliceSize = originalConfig.totalSize / originalConfig.totalOrders;
    let standardTWAPWeightedSum = 0;
    const standardTWAPTotalShares = equalSliceSize * executedOrders.length;
    
    for (const order of executedOrders) {
      // Standard TWAP: same slice size for each order, at the market price at that time
      standardTWAPWeightedSum += order.price * equalSliceSize;
    }
    
    standardTWAPAvgPrice = standardTWAPTotalShares > 0 ? standardTWAPWeightedSum / standardTWAPTotalShares : 0;
  } else {
    // Fallback: estimate equal slice from actual execution
    const totalOrders = results.length;
    const equalSliceSize = totalExecuted / totalOrders;
    let standardTWAPWeightedSum = 0;
    const standardTWAPTotalShares = equalSliceSize * executedOrders.length;
    
    for (const order of executedOrders) {
      standardTWAPWeightedSum += order.price * equalSliceSize;
    }
    
    standardTWAPAvgPrice = standardTWAPTotalShares > 0 ? standardTWAPWeightedSum / standardTWAPTotalShares : 0;
  }
  
  return {
    totalExecuted,
    averagePrice: weightedAvgPrice,
    averageSlippage: avgSlippage,
    vwapPerformance,
    averageMultiplier: avgMultiplier,
    executionRate: (executedOrders.length / results.length) * 100,
    vwapEnhancedAvgPrice,
    standardTWAPAvgPrice
  };
}
