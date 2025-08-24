/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ethers } from "ethers";
import { createExchangeClient, createInfoClient, createHyperliquidClients } from "../hyperliquid/clientFactory";

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
    useTestnet: boolean = true,
    marketType: "PERP" | "SPOT" = "PERP"
): Promise<OrderResult> {
    try {
        const wallet = new ethers.Wallet(privateKey);
        
        // Create exchange client with agent wallet
        const exchangeClient = createExchangeClient(wallet, { 
            useTestnet
        });
        
        console.log(`📤 Placing ${marketType} order:`, {
            asset: orderParams.asset,
            isBuy: orderParams.isBuy,
            price: orderParams.price,
            size: orderParams.size,
            timeInForce: orderParams.timeInForce,
            agentWallet: wallet.address,
        });
        
        const orderRequest: any = {
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
        };

        console.log(`📝 Order request:`, JSON.stringify(orderRequest, null, 2));
        
        const result = await exchangeClient.order(orderRequest);
        
        const statuses = result.response?.data?.statuses;
        if (statuses && Array.isArray(statuses) && statuses.length > 0) {
            const status = statuses[0];
            
            if ('error' in status && status.error) {
                return {
                    success: false,
                    error: String(status.error)
                };
            }
        }
        
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

// Get market info for a specific asset and market type
export async function getMarketInfo(
    asset: string,
    useTestnet: boolean = true,
    marketType: "PERP" | "SPOT" = "PERP"
): Promise<any> {
    const infoClient = createInfoClient({ useTestnet });
    
    try {
        if (marketType === "SPOT") {
            // For SPOT markets, use spotMeta endpoint
            const spotMeta = await infoClient.spotMeta();
            
            if (!spotMeta || !spotMeta.tokens || !spotMeta.universe) {
                throw new Error(`No spot meta data available`);
            }
            
            // Find the token by name
            let tokenId: number | null = null;
            for (const [id, tokenInfo] of Object.entries(spotMeta.tokens)) {
                if (tokenInfo.name === asset) {
                    tokenId = parseInt(id);
                    break;
                }
            }
            
            if (tokenId === null) {
                throw new Error(`Spot token ${asset} not found`);
            }
            
            // Find the spot pair universe index where this token appears
            let spotAssetId: number | null = null;
            let spotInfo = null;
            for (let i = 0; i < spotMeta.universe.length; i++) {
                const universeInfo = spotMeta.universe[i];
                if (universeInfo.tokens && 
                    (universeInfo.tokens[0] === tokenId || universeInfo.tokens[1] === tokenId)) {
                    spotAssetId = 10000 + i;
                    spotInfo = universeInfo;
                    break;
                }
            }
            
            if (spotAssetId === null || !spotInfo) {
                throw new Error(`Spot pair for ${asset} not found in universe`);
            }
            
            console.log(`📊 Found SPOT market for ${asset}: tokenId=${tokenId}, universeIndex=${spotAssetId - 10000}, spotAssetId=${spotAssetId}`);
            
            // Get the token info for decimals
            const tokenInfo = (spotMeta.tokens as any)[tokenId.toString()];
            
            return {
                name: asset,
                assetInfo: { index: spotAssetId },
                szDecimals: tokenInfo?.szDecimals || 0
            };
        } else {
            // For PERP markets, use regular meta endpoint
            const meta = await infoClient.meta();
            const universe = meta.universe;
            
            const assetInfo = universe.find(u => u.name === asset);
            if (!assetInfo) {
                throw new Error(`PERP asset ${asset} not found`);
            }
            
            console.log(`📊 Found PERP market for ${asset}:`, assetInfo);
            
            return assetInfo;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to get ${marketType} market info: ${errorMessage}`);
    }
}