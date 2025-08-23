"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Navigation from "@/components/Navigation";
import CandleChart from "@/components/CandleChart";
import OrderConfiguration from "@/components/trading/OrderConfiguration";
import { MarketType } from "@/components/trading/MarketTypeSelector";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  VWAPEnhancedConfig,
  CandleData,
  roundOrderSizeForAsset,
  initializeVWAP,
  updateVWAP,
  calculateVWAPOrderSize,
} from "@/core/trade/vwapEnhancedTWAP";
import { getMarketInfo, placeOrder, TWAPOrderParams } from "@/core";
import { fetchOrderBook } from "@/core/hyperliquid/orderbook";
import { formatHyperliquidPrice, validateHyperliquidPrice } from "@/core/hyperliquid/formatting";

type TimeInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface TWAPConfig {
  asset: string;
  side: "BUY" | "SELL";
  totalSize: number;
  totalOrders: number;
  maxSlippage: number;
  vwapAlpha: number;
  minMultiplier: number;
  maxMultiplier: number;
  maxParticipation: number;
  timeInterval: number;
  marketType: MarketType;
}

export default function Home() {
  const [selectedCoin, setSelectedCoin] = useState("HYPE");
  const [selectedMarketType, setSelectedMarketType] = useState<MarketType>("PERP");
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval>("15m");
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [activeTWAP, setActiveTWAP] = useState<TWAPConfig | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [assetRoundingInfo, setAssetRoundingInfo] = useState<{
    asset: string;
    decimals: number;
    example: string;
  } | null>(null);

  const { isTestnet } = useNetwork();
  const { walletState } = useWallet();

  // Store candle data for TWAP execution
  const chartCandlesRef = useRef<CandleData[]>([]);

  // Handle chart data updates
  const handleChartDataUpdate = useCallback(
    (
      candles: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }[]
    ) => {
      const convertedCandles: CandleData[] = candles.map((candle) => ({
        high: Number(candle.high) || 0,
        low: Number(candle.low) || 0,
        close: Number(candle.close) || 0,
        volume: Number(candle.volume) || 0,
        timestamp: candle.time || Date.now(),
      }));

      chartCandlesRef.current = convertedCandles;
      if (candles && candles.length > 0) {
        setCurrentPrice(candles[candles.length - 1].close);
      }
    },
    []
  );

  // Load asset info when coin or market type changes
  useEffect(() => {
    const loadAssetInfo = async () => {
      try {
        const marketInfo = await getMarketInfo(selectedCoin, isTestnet(), selectedMarketType);

        if (marketInfo) {
          // Use explicit null/undefined checking to handle 0 decimals correctly
          const decimals =
            marketInfo.szDecimals !== null && marketInfo.szDecimals !== undefined
              ? marketInfo.szDecimals
              : 4;

          setAssetRoundingInfo({
            asset: selectedCoin,
            decimals: decimals,
            example: decimals === 0 ? "1.008672 → 1" : `1.008672 → ${(1.008672).toFixed(decimals)}`,
          });
        }
      } catch (error) {
        console.log("Could not load asset info:", error);
        setAssetRoundingInfo(null);
      }
    };

    loadAssetInfo();
  }, [selectedCoin, selectedMarketType, isTestnet]);

  const handleIntervalChange = (interval: TimeInterval) => {
    setSelectedInterval(interval);
  };

  const handleTokenChange = (token: string) => {
    setSelectedCoin(token);
  };

  const handleMarketTypeChange = (marketType: MarketType) => {
    setSelectedMarketType(marketType);
  };

  // Remove the getFullCoinSymbol function since we'll pass marketType separately

  const handleConfigSubmit = async (config: TWAPConfig) => {
    console.log("🎯 Starting Live TWAP with config:", config);

    if (!walletState.isConnected || !walletState.isAgentAuthorized) {
      alert("❌ Please connect your wallet and authorize the agent first!");
      return;
    }

    if (!walletState.agentWallet?.privateKey) {
      alert("❌ No agent wallet private key available. Please reconnect your wallet.");
      return;
    }

    if (chartCandlesRef.current.length === 0) {
      alert("⏳ Waiting for chart data to load...");
      return;
    }

    const confirmMessage = `🚨 LIVE TRADING CONFIRMATION 🚨

You are about to place REAL orders on Hyperliquid ${isTestnet() ? "TESTNET" : "MAINNET"}:

Asset: ${config.asset}
Side: ${config.side}
Total Size: ${config.totalSize}
Orders: ${config.totalOrders}
Network: ${isTestnet() ? "TESTNET" : "MAINNET"}

This will place actual orders with real money${isTestnet() ? " (testnet)" : ""}!

Are you sure you want to continue?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setActiveTWAP(config);
      setIsExecuting(true);
      setExecutionLog([]);
      setExecutionProgress(0);

      // Add initial log
      setExecutionLog((prev) => [
        ...prev,
        `🚀 Starting LIVE TWAP execution for ${config.asset} on ${
          isTestnet() ? "TESTNET" : "MAINNET"
        }`,
      ]);

      // Show asset rounding information
      if (assetRoundingInfo) {
        const baseOrderSize = config.totalSize / config.totalOrders;
        const roundedSize = roundOrderSizeForAsset(baseOrderSize, assetRoundingInfo.decimals);
        setExecutionLog((prev) => [
          ...prev,
          `📏 Order size rounded from ${baseOrderSize.toFixed(6)} to ${roundedSize} (${
            assetRoundingInfo.decimals
          } decimals)`,
        ]);
      }

      // Create VWAP Enhanced TWAP configuration
      const vwapConfig: VWAPEnhancedConfig = {
        totalSize: config.totalSize,
        totalOrders: config.totalOrders,
        timeInterval: config.timeInterval * 1000, // Convert to milliseconds
        maxSlippagePercent: config.maxSlippage,
        vwapAlpha: config.vwapAlpha,
        maxMultiplier: config.maxMultiplier,
        minMultiplier: config.minMultiplier,
        vwapPeriod: 20, // Use 20-period VWAP
        asset: config.asset,
        side: config.side.toLowerCase() as "buy" | "sell",
      };

      setExecutionLog((prev) => [
        ...prev,
        `⚙️ Configuration: ${config.totalOrders} orders over ${config.timeInterval}s intervals`,
      ]);

      // Execute LIVE TWAP orders
      await executeLiveTWAP(vwapConfig, chartCandlesRef.current);
    } catch (error) {
      setIsExecuting(false);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to start TWAP:", errorMessage);
      setExecutionLog((prev) => [...prev, `❌ Error: ${errorMessage}`]);
      alert(`❌ Failed to start TWAP: ${errorMessage}`);
    }
  };

  // Get current market price from orderbook
  const getCurrentMarketPrice = async (asset: string, side: "buy" | "sell"): Promise<number> => {
    try {
      console.log(`🔍 Fetching orderbook for: ${asset} (market: ${selectedMarketType})`);

      const orderbook = await fetchOrderBook(asset, isTestnet(), selectedMarketType);
      if (!orderbook || !orderbook.levels) {
        throw new Error(`No orderbook data for ${asset}`);
      }

      const [bids, asks] = orderbook.levels;

      console.log(`📊 Orderbook data for ${asset} (${selectedMarketType}):`);
      console.log(`   Best bid: ${bids.length > 0 ? bids[0].px : "N/A"}`);
      console.log(`   Best ask: ${asks.length > 0 ? asks[0].px : "N/A"}`);

      if (side === "buy" && asks.length > 0) {
        const bestAskPrice = parseFloat(asks[0].px);
        console.log(`💰 Using best ask price for BUY: $${bestAskPrice}`);
        return bestAskPrice;
      } else if (side === "sell" && bids.length > 0) {
        const bestBidPrice = parseFloat(bids[0].px);
        console.log(`💰 Using best bid price for SELL: $${bestBidPrice}`);
        return bestBidPrice;
      }

      throw new Error(`No ${side === "buy" ? "asks" : "bids"} available`);
    } catch (error) {
      console.warn(`Failed to get orderbook price for ${asset}, using candle price`);
      console.error("Orderbook error:", error);
      // Fallback to candle price
      return chartCandlesRef.current[chartCandlesRef.current.length - 1]?.close || 0;
    }
  };

  // Live TWAP execution function - REAL TRADING
  const executeLiveTWAP = async (config: VWAPEnhancedConfig, candles: CandleData[]) => {
    try {
      if (!walletState.agentWallet?.privateKey) {
        throw new Error("No agent wallet private key available");
      }

      if (!walletState.address) {
        throw new Error("No main wallet address found. Please reconnect your wallet.");
      }

      // Get asset info for order formatting
      const marketInfo = await getMarketInfo(config.asset, isTestnet(), selectedMarketType);
      if (!marketInfo) {
        throw new Error(`Could not find market info for ${config.asset}`);
      }

      console.log(`📋 Market info for ${config.asset} (${selectedMarketType}):`, marketInfo);
      console.log(`🤖 Agent wallet ${walletState.agentWallet.address} executing TWAP orders`);

      const assetIndex = marketInfo.assetInfo?.index || 0;
      const assetDecimals =
        marketInfo.szDecimals !== null && marketInfo.szDecimals !== undefined
          ? marketInfo.szDecimals
          : 4;

      setExecutionLog((prev) => [
        ...prev,
        `🎯 Asset: ${config.asset} (Index: ${assetIndex}, Decimals: ${assetDecimals})`,
        `🤖 Trading on behalf of: ${walletState.address}`,
      ]);

      // Initialize VWAP from candle data
      let vwapData = initializeVWAP(candles);
      setExecutionLog((prev) => [...prev, `� Initial VWAP: $${vwapData.vwap.toFixed(6)}`]);

      // Calculate order parameters
      const baseOrderSize = config.totalSize / config.totalOrders;
      const currentPrice = candles[candles.length - 1]?.close || 0;

      if (currentPrice === 0) {
        throw new Error("Could not determine current market price");
      }

      setExecutionLog((prev) => [...prev, `💰 Current Price: $${currentPrice.toFixed(6)}`]);
      setExecutionLog((prev) => [...prev, `📦 Base Order Size: ${baseOrderSize} ${config.asset}`]);

      // Execute TWAP orders in sequence
      for (let i = 0; i < config.totalOrders; i++) {
        try {
          // Get current market price from orderbook for each order
          const currentMarketPrice = await getCurrentMarketPrice(config.asset, config.side);

          setExecutionLog((prev) => [
            ...prev,
            `💰 Current Market Price: $${currentMarketPrice.toFixed(6)} (Order ${i + 1})`,
          ]);

          // Update VWAP with latest candle data if available
          const latestCandle = candles[candles.length - 1];
          if (latestCandle) {
            vwapData = updateVWAP(vwapData, latestCandle);
          }

          // Calculate VWAP-adjusted order size
          const vwapOrderSize = calculateVWAPOrderSize(
            baseOrderSize,
            currentMarketPrice, // Use current market price instead of old candle price
            vwapData.vwap,
            config.vwapAlpha,
            config.maxMultiplier,
            config.minMultiplier
          );

          // Round order size according to asset decimals
          const roundedSize = roundOrderSizeForAsset(vwapOrderSize.adjustedSize, assetDecimals);

          setExecutionLog((prev) => [
            ...prev,
            `� Order ${i + 1}/${config.totalOrders}: ${vwapOrderSize.adjustedSize.toFixed(
              6
            )} → ${roundedSize} (${vwapOrderSize.multiplier.toFixed(2)}x)`,
          ]);

          // Calculate order price with small slippage for better execution
          // For buys: slightly above market price, for sells: slightly below market price
          const slippageBuffer = 0.001; // 0.1% slippage buffer
          const orderPrice =
            config.side === "buy"
              ? currentMarketPrice * (1 + slippageBuffer)
              : currentMarketPrice * (1 - slippageBuffer);

          // Ensure order price is within Hyperliquid's 80% constraint
          const maxPriceDeviation = 0.75; // Use 75% to be safe (Hyperliquid allows 80%)
          const minAllowedPrice = currentMarketPrice * (1 - maxPriceDeviation);
          const maxAllowedPrice = currentMarketPrice * (1 + maxPriceDeviation);

          const constrainedPrice = Math.max(minAllowedPrice, Math.min(maxAllowedPrice, orderPrice));

          // Format price according to Hyperliquid's precision rules
          const formattedPrice = formatHyperliquidPrice(
            constrainedPrice,
            assetDecimals,
            selectedMarketType === "SPOT"
          );

          // Validate the formatted price
          const priceValidation = validateHyperliquidPrice(
            formattedPrice,
            assetDecimals,
            selectedMarketType === "SPOT"
          );

          if (!priceValidation.isValid) {
            setExecutionLog((prev) => [
              ...prev,
              `❌ Order ${i + 1} price validation failed: ${priceValidation.reason}`,
            ]);
            continue; // Skip this order and continue with next
          }

          // Prepare order parameters for Hyperliquid (matching temp_trade working format)
          const orderParams: TWAPOrderParams = {
            asset: assetIndex,
            isBuy: config.side === "buy",
            price: formattedPrice,
            size: roundedSize.toString(),
            timeInForce: "Ioc" as const, // Use IOC (Immediate or Cancel) for better execution
            reduceOnly: false,
          };

          setExecutionLog((prev) => [
            ...prev,
            `📤 Placing ${config.side.toUpperCase()} order ${i + 1}: ${roundedSize} ${
              config.asset
            } @ $${formattedPrice} (IOC)`,
          ]);

          // PLACE REAL ORDER ON HYPERLIQUID (using working temp_trade pattern)
          const orderResult = await placeOrder(
            walletState.agentWallet.privateKey,
            orderParams,
            isTestnet(),
            selectedMarketType
          );

          if (orderResult.success) {
            setExecutionLog((prev) => [
              ...prev,
              `✅ Order ${i + 1} placed successfully! Order ID: ${orderResult.orderId}`,
            ]);
          } else {
            setExecutionLog((prev) => [...prev, `❌ Order ${i + 1} failed: ${orderResult.error}`]);
          }

          // Update progress
          setExecutionProgress(((i + 1) / config.totalOrders) * 100);

          // Wait for the configured interval before next order (except for last order)
          if (i < config.totalOrders - 1) {
            setExecutionLog((prev) => [
              ...prev,
              `⏱️ Waiting ${config.timeInterval / 1000}s for next order...`,
            ]);
            await new Promise((resolve) => setTimeout(resolve, config.timeInterval));
          }
        } catch (orderError) {
          setExecutionLog((prev) => [
            ...prev,
            `❌ Order ${i + 1} error: ${
              orderError instanceof Error ? orderError.message : String(orderError)
            }`,
          ]);
          // Continue with next order even if one fails
        }
      }

      setExecutionLog((prev) => [
        ...prev,
        `🎉 TWAP execution completed! Check your Hyperliquid account for orders.`,
      ]);
      setIsExecuting(false);
    } catch (error) {
      setExecutionLog((prev) => [
        ...prev,
        `❌ Execution failed: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      setIsExecuting(false);
    }
  };

  const handleStopTWAP = () => {
    console.log("🛑 Stopping TWAP");
    setActiveTWAP(null);
    setIsExecuting(false);
    setExecutionLog((prev) => [...prev, "🛑 TWAP execution stopped by user"]);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <Navigation />

      {/* Live Trading Header */}
      <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Live Trading</h1>
              <p className="text-sm text-gray-300">
                Execute real TWAP orders with wallet connection
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {activeTWAP && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">
                  TWAP Active: {activeTWAP.asset} {activeTWAP.side}
                </span>
                <button
                  onClick={handleStopTWAP}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  Stop
                </button>
              </div>
            )}

            <div className="text-sm text-gray-400">Mainnet Data • Real Trading</div>
          </div>
        </div>
      </div>

      {/* Main Layout: Chart | Configuration */}
      <div className="flex h-[calc(100vh-120px)]">
        {/* Chart Section - 4/5 width */}
        <div className="flex-1 w-4/5 flex flex-col">
          {/* Chart Header */}
          <div className="p-4 pb-2">
            <div className="flex items-center space-x-4 mb-4">
              <div className="text-xl font-semibold text-white">
                {selectedCoin} {selectedMarketType} Chart
              </div>
              <div className="text-sm text-gray-400">
                Live market data from Hyperliquid {isTestnet() ? "Testnet" : "Mainnet"}
              </div>
            </div>
          </div>

          {/* Chart - Top Half */}
          <div className="flex-1 px-4 pb-2">
            <CandleChart
              coin={selectedCoin}
              interval={selectedInterval}
              onIntervalChange={handleIntervalChange}
              showVWAP={true}
              vwapPeriod={20}
              network={isTestnet() ? "testnet" : "mainnet"}
              marketType={selectedMarketType}
              onDataUpdate={handleChartDataUpdate}
            />
          </div>

          {/* Position History & Controls - Bottom Half */}
          <div className="h-1/2 p-4 pt-2">
            <div className="bg-gray-900 rounded-lg p-4 h-full">
              <h2 className="text-xl font-bold text-white mb-4">
                Live Execution Status & Order History
              </h2>

              {/* Asset Rounding Information */}
              {assetRoundingInfo && (
                <div className="mb-4 p-3 bg-amber-900/20 border border-amber-500 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-amber-400 text-sm">⚡</span>
                    <span className="text-amber-400 text-sm font-medium">
                      Hyperliquid Order Size Compliance
                    </span>
                  </div>
                  <div className="text-xs text-gray-300">
                    <div className="mb-1">
                      <span className="text-amber-400">{assetRoundingInfo.asset}</span> orders
                      rounded to{" "}
                      {assetRoundingInfo.decimals === 0 ? (
                        <span className="text-white font-semibold">whole numbers</span>
                      ) : (
                        <span className="text-white font-semibold">
                          {assetRoundingInfo.decimals} decimal places
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400">{assetRoundingInfo.example}</div>
                  </div>
                </div>
              )}

              {/* Wallet Status */}
              <div className="mb-4 p-3 bg-gray-800 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-400">Wallet:</span>
                    <span
                      className={`ml-2 text-sm ${
                        walletState.isConnected ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {walletState.isConnected ? "✅ Connected" : "❌ Not Connected"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-400">Agent:</span>
                    <span
                      className={`ml-2 text-sm ${
                        walletState.isAgentAuthorized ? "text-green-400" : "text-yellow-400"
                      }`}
                    >
                      {walletState.isAgentAuthorized ? "✅ Authorized" : "⚠️ Not Authorized"}
                    </span>
                  </div>
                </div>
              </div>

              {activeTWAP ? (
                <div className="space-y-4">
                  {/* Active TWAP Status */}
                  <div className="bg-green-900/20 border border-green-500 rounded p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-green-400 font-medium">
                          {isExecuting ? "🔥 Executing Live TWAP" : "✅ TWAP Configured"}
                        </h3>
                        <div className="text-sm text-gray-300 mt-1">
                          {activeTWAP.asset} • {activeTWAP.side} • {activeTWAP.totalSize} shares •{" "}
                          {activeTWAP.totalOrders} orders • {selectedMarketType}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono ${
                            isExecuting ? "text-green-400" : "text-blue-400"
                          }`}
                        >
                          {isExecuting ? "Live Trading..." : "Ready to Execute"}
                        </div>
                        <div className="text-xs text-gray-400">
                          Max Slippage: {activeTWAP.maxSlippage}% • Interval:{" "}
                          {activeTWAP.timeInterval}s
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>
                          {Math.round(executionProgress)}% •{" "}
                          {Math.round((executionProgress * activeTWAP.totalOrders) / 100)} /{" "}
                          {activeTWAP.totalOrders} orders
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isExecuting ? "bg-green-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${executionProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Execution Log */}
                  <div className="bg-gray-800 rounded p-4 h-64 overflow-y-auto">
                    <h4 className="text-white font-medium mb-2">Execution Log</h4>
                    {executionLog.length === 0 ? (
                      <div className="text-gray-400 text-sm">
                        {isExecuting
                          ? "Starting execution..."
                          : "Ready to start execution when you click 'Start TWAP'"}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {executionLog.map((log, index) => (
                          <div key={index} className="text-xs text-gray-300 font-mono">
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <div className="text-4xl mb-4">📊</div>
                    <h3 className="text-lg font-medium mb-2">No Active Orders</h3>
                    <p className="text-sm">
                      Configure and start a TWAP order to see execution history
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Configuration Section - 1/5 width */}
        <div className="w-1/5 border-l border-gray-800 p-4">
          <OrderConfiguration
            onConfigSubmit={handleConfigSubmit}
            currentPrice={currentPrice}
            selectedToken={selectedCoin}
            selectedMarketType={selectedMarketType}
            onTokenChange={handleTokenChange}
            onMarketTypeChange={handleMarketTypeChange}
            isSimulation={false}
            isExecuting={isExecuting}
            walletReady={walletState.isConnected && walletState.isAgentAuthorized}
          />
        </div>
      </div>
    </div>
  );
}
