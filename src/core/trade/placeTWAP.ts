import { ethers } from "ethers";
import * as hl from "@nktkas/hyperliquid";
import { createExchangeClient, createInfoClient, createHyperliquidClients } from "../hyperliquid/clientFactory";

// Types
export interface TWAPOrderParams {
    asset: number;
    isBuy: boolean;
    price: string;
    size: string;
    timeInForce?: "Gtc" | "Ioc" | "Alo";
    reduceOnly?: boolean;
}

export interface TWAPConfig {
    totalSize: string;
    sliceSize: string;
    intervalMs: number;
    maxSlices: number;
}

export interface OrderResult {
    success: boolean;
    orderId?: string;
    error?: string;
}

export async function placeOrder(
    privateKey: string, 
    orderParams: TWAPOrderParams, 
    useTestnet: boolean = true
): Promise<OrderResult> {
    try {
        const wallet = new ethers.Wallet(privateKey);
        const exchangeClient = createExchangeClient(wallet, { useTestnet });
        
        const result = await exchangeClient.order({
            orders: [{
                a: orderParams.asset,
                b: orderParams.isBuy,
                p: orderParams.price,
                r: orderParams.reduceOnly || false,
                s: orderParams.size,
                t: {
                    limit: {
                        tif: orderParams.timeInForce || "Gtc",
                    },
                }
            }],
            grouping: "na",
        });
        
        return {
            success: true,
            orderId: result.response?.data?.statuses?.[0] ? 
                ('resting' in result.response.data.statuses[0] ? 
                    result.response.data.statuses[0].resting.oid.toString() : 
                    result.response.data.statuses[0].filled.oid.toString()) : 
                "unknown"
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
            success: false,
            error: `Order placement failed: ${errorMessage}`
        };
    }
}

// Execute TWAP strategy
export async function executeTWAP(
    privateKey: string,
    orderParams: TWAPOrderParams,
    twapConfig: TWAPConfig,
    useTestnet: boolean = true
): Promise<{
    completedOrders: OrderResult[];
    totalExecuted: string;
    errors: string[];
}> {
    const wallet = new ethers.Wallet(privateKey);
    const clients = createHyperliquidClients(wallet, { useTestnet });
    
    const completedOrders: OrderResult[] = [];
    const errors: string[] = [];
    let totalExecuted = "0";
    
    const totalSizeNum = parseFloat(twapConfig.totalSize);
    const sliceSizeNum = parseFloat(twapConfig.sliceSize);
    const numSlices = Math.min(Math.ceil(totalSizeNum / sliceSizeNum), twapConfig.maxSlices);
    const actualSliceSize = totalSizeNum / numSlices;
    
    for (let i = 0; i < numSlices; i++) {
        const isLastSlice = i === numSlices - 1;
        const sliceSize = isLastSlice 
            ? (totalSizeNum - parseFloat(totalExecuted)).toString()
            : actualSliceSize.toString();
        
        const sliceOrder: TWAPOrderParams = {
            ...orderParams,
            size: sliceSize
        };
        
        const result = await placeOrder(privateKey, sliceOrder, useTestnet);
        completedOrders.push(result);
        
        if (result.success) {
            totalExecuted = (parseFloat(totalExecuted) + parseFloat(sliceSize)).toString();
        } else {
            errors.push(result.error || "Unknown error");
        }
        
        // Wait before next slice (except for the last one)
        if (!isLastSlice) {
            await new Promise(resolve => setTimeout(resolve, twapConfig.intervalMs));
        }
    }
    
    return {
        completedOrders,
        totalExecuted,
        errors
    };
}

// Get market info for a specific asset
export async function getMarketInfo(
    asset: string,
    useTestnet: boolean = true
): Promise<any> {
    const infoClient = createInfoClient({ useTestnet });
    
    try {
        const meta = await infoClient.meta();
        const universe = meta.universe;
        
        const assetInfo = universe.find(u => u.name === asset);
        if (!assetInfo) {
            throw new Error(`Asset ${asset} not found`);
        }
        
        return assetInfo;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to get market info: ${errorMessage}`);
    }
}