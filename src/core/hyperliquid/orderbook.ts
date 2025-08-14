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
