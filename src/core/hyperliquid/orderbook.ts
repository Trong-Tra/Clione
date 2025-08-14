import * as hl from "@nktkas/hyperliquid";
import { createInfoClient } from "./clientFactory";

export interface OrderBookLevel {
  px: string;  // price
  sz: string;  // size
}

export interface OrderBook {
  coin: string;
  levels: [OrderBookLevel[], OrderBookLevel[]]; // [bids, asks]
  time: number;
}

export interface SlippageInfo {
  estimatedPrice: number;
  slippagePercent: number;
  depth: number;
  wouldExecute: boolean;
}

export interface MarketDepthAnalysis {
  totalBidVolume: number;
  totalAskVolume: number;
  bidDepth: number;
  askDepth: number;
  spread: number;
  spreadPercent: number;
  midPrice: number;
}

/**
 * Fetch order book for a specific asset
 */
export async function fetchOrderBook(
  asset: string,
  useTestnet: boolean = true
): Promise<OrderBook | null> {
  try {
    const infoClient = createInfoClient({ useTestnet });
    
    const l2Response = await infoClient.l2Book({ coin: asset });
    
    if (!l2Response || !l2Response.levels) {
      console.error(`No order book data available for ${asset}`);
      return null;
    }

    return {
      coin: asset,
      levels: l2Response.levels,
      time: Date.now()
    };
  } catch (error) {
    console.error(`Failed to fetch order book for ${asset}:`, error);
    return null;
  }
}

/**
 * Calculate slippage for a given order size
 */
export function calculateSlippage(
  orderBook: OrderBook,
  size: number,
  isBuy: boolean
): SlippageInfo {
  const levels = isBuy ? orderBook.levels[1] : orderBook.levels[0]; // asks for buy, bids for sell
  
  if (!levels || levels.length === 0) {
    return {
      estimatedPrice: 0,
      slippagePercent: 100,
      depth: 0,
      wouldExecute: false
    };
  }

  let remainingSize = size;
  let totalCost = 0;
  let depth = 0;

  // Sort levels by price (ascending for asks, descending for bids)
  const sortedLevels = [...levels].sort((a, b) => {
    const priceA = parseFloat(a.px);
    const priceB = parseFloat(b.px);
    return isBuy ? priceA - priceB : priceB - priceA;
  });

  for (const level of sortedLevels) {
    const levelPrice = parseFloat(level.px);
    const levelSize = parseFloat(level.sz);
    
    if (remainingSize <= 0) break;
    
    const sizeToTake = Math.min(remainingSize, levelSize);
    totalCost += sizeToTake * levelPrice;
    remainingSize -= sizeToTake;
    depth++;
    
    if (remainingSize <= 0) break;
  }

  const wouldExecute = remainingSize <= 0;
  const estimatedPrice = wouldExecute ? totalCost / size : 0;
  
  // Calculate slippage against best price
  const bestPrice = parseFloat(sortedLevels[0].px);
  const slippagePercent = wouldExecute 
    ? Math.abs((estimatedPrice - bestPrice) / bestPrice * 100)
    : 100;

  return {
    estimatedPrice,
    slippagePercent,
    depth,
    wouldExecute
  };
}

/**
 * Analyze market depth for volume constraints
 */
export function analyzeMarketDepth(orderBook: OrderBook): MarketDepthAnalysis {
  const [bids, asks] = orderBook.levels;
  
  if (!bids || !asks || bids.length === 0 || asks.length === 0) {
    return {
      totalBidVolume: 0,
      totalAskVolume: 0,
      bidDepth: 0,
      askDepth: 0,
      spread: 0,
      spreadPercent: 0,
      midPrice: 0
    };
  }

  // Calculate total volumes
  const totalBidVolume = bids.reduce((sum, level) => sum + parseFloat(level.sz), 0);
  const totalAskVolume = asks.reduce((sum, level) => sum + parseFloat(level.sz), 0);
  
  // Get best prices
  const bestBid = Math.max(...bids.map(level => parseFloat(level.px)));
  const bestAsk = Math.min(...asks.map(level => parseFloat(level.px)));
  
  const spread = bestAsk - bestBid;
  const midPrice = (bestBid + bestAsk) / 2;
  const spreadPercent = (spread / midPrice) * 100;

  return {
    totalBidVolume,
    totalAskVolume,
    bidDepth: bids.length,
    askDepth: asks.length,
    spread,
    spreadPercent,
    midPrice
  };
}

/**
 * Check if market can handle a given volume without excessive slippage
 */
export function checkVolumeConstraints(
  orderBook: OrderBook,
  totalVolume: number,
  isBuy: boolean,
  maxSlippagePercent: number = 2.0,
  maxVolumePercent: number = 10.0
): {
  canHandle: boolean;
  reason?: string;
  suggestedMaxVolume?: number;
  marketDepth: MarketDepthAnalysis;
} {
  const marketDepth = analyzeMarketDepth(orderBook);
  const relevantVolume = isBuy ? marketDepth.totalAskVolume : marketDepth.totalBidVolume;
  
  // Check volume constraint
  const volumePercent = (totalVolume / relevantVolume) * 100;
  if (volumePercent > maxVolumePercent) {
    return {
      canHandle: false,
      reason: `Order volume (${volumePercent.toFixed(2)}%) exceeds market depth limit (${maxVolumePercent}%)`,
      suggestedMaxVolume: relevantVolume * (maxVolumePercent / 100),
      marketDepth
    };
  }

  // Check slippage constraint
  const slippageInfo = calculateSlippage(orderBook, totalVolume, isBuy);
  if (!slippageInfo.wouldExecute) {
    return {
      canHandle: false,
      reason: "Insufficient liquidity to execute order",
      suggestedMaxVolume: relevantVolume * 0.8, // Conservative estimate
      marketDepth
    };
  }

  if (slippageInfo.slippagePercent > maxSlippagePercent) {
    return {
      canHandle: false,
      reason: `Estimated slippage (${slippageInfo.slippagePercent.toFixed(2)}%) exceeds limit (${maxSlippagePercent}%)`,
      suggestedMaxVolume: findMaxVolumeForSlippage(orderBook, isBuy, maxSlippagePercent),
      marketDepth
    };
  }

  return {
    canHandle: true,
    marketDepth
  };
}

/**
 * Find maximum volume that can be executed within slippage tolerance
 */
function findMaxVolumeForSlippage(
  orderBook: OrderBook,
  isBuy: boolean,
  maxSlippagePercent: number
): number {
  const levels = isBuy ? orderBook.levels[1] : orderBook.levels[0];
  
  if (!levels || levels.length === 0) return 0;

  const sortedLevels = [...levels].sort((a, b) => {
    const priceA = parseFloat(a.px);
    const priceB = parseFloat(b.px);
    return isBuy ? priceA - priceB : priceB - priceA;
  });

  const bestPrice = parseFloat(sortedLevels[0].px);
  let cumulativeVolume = 0;
  let totalCost = 0;

  for (const level of sortedLevels) {
    const levelPrice = parseFloat(level.px);
    const levelSize = parseFloat(level.sz);
    
    const newVolume = cumulativeVolume + levelSize;
    const newCost = totalCost + (levelSize * levelPrice);
    const avgPrice = newCost / newVolume;
    const slippage = Math.abs((avgPrice - bestPrice) / bestPrice * 100);
    
    if (slippage > maxSlippagePercent) {
      break;
    }
    
    cumulativeVolume = newVolume;
    totalCost = newCost;
  }

  return cumulativeVolume * 0.9; // Add 10% buffer
}
