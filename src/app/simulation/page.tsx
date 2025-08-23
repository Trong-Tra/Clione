"use client";

import { useState, useEffect, useRef } from "react";
import Navigation from "../../components/Navigation";
import {
  VWAPEnhancedConfig,
  VWAPSimulationResult,
  simulateVWAPEnhancedTWAP,
  calculateVWAPPerformance,
  CandleData,
  VWAPData,
  roundOrderSizeForAsset,
} from "../../core/trade/vwapEnhancedTWAP";
import { getMarketInfo } from "../../core/trade/placeTWAP";
import CandleChart from "@/components/CandleChart";
import OrderConfiguration from "@/components/trading/OrderConfiguration";
import { MarketType } from "@/components/trading/MarketTypeSelector";
import { useWallet } from "@/contexts/WalletContext";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  fetchOrderBook,
  calculateSlippage,
  checkVolumeConstraints,
} from "../../core/hyperliquid/orderbook";

type TimeInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

// Legacy TWAPConfig interface for compatibility with OrderConfiguration
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
  vwapPeriod: number;
  marketType: MarketType;
}

export default function SimulationPage() {
  const [selectedCoin, setSelectedCoin] = useState("HYPE");
  const [selectedMarketType, setSelectedMarketType] = useState<MarketType>("PERP");
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval>("15m");
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState<TWAPConfig | null>(null);
  const [assetRoundingInfo, setAssetRoundingInfo] = useState<{
    asset: string;
    decimals: number;
    roundingActive: boolean;
  } | null>(null);
  const [simulationResults, setSimulationResults] = useState<VWAPSimulationResult[]>([]);
  const [progress, setProgress] = useState(0);

  // Wallet state from context
  const { walletState } = useWallet();
  const { isTestnet } = useNetwork();

  // Chart data state to ensure simulation uses same data as chart
  const [chartCandles, setChartCandles] = useState<CandleData[]>([]);
  const [chartVWAPData, setChartVWAPData] = useState<VWAPData | undefined>();

  // Add ref to access latest chart data during simulation
  const chartCandlesRef = useRef<CandleData[]>([]);
  const chartVWAPDataRef = useRef<VWAPData | undefined>(undefined);

  // Update refs whenever chart data changes
  useEffect(() => {
    chartCandlesRef.current = chartCandles;
    chartVWAPDataRef.current = chartVWAPData;
  }, [chartCandles, chartVWAPData]); // Use ref to track simulation state for async operations
  const simulationActiveRef = useRef(false);

  // Fetch market data for simulation
  const fetchMarketData = async (
    coin: string,
    interval: string,
    count: number
  ): Promise<CandleData[]> => {
    try {
      const response = await fetch(`/api/candles?coin=${coin}&interval=${interval}&count=${count}`);
      const result = await response.json();

      if (result.success && result.data) {
        return result.data.map((candle: any) => ({
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          timestamp: candle.time * 1000 || Date.now(), // Convert time to timestamp in milliseconds
        }));
      }
      return [];
    } catch (error) {
      console.error("Error fetching market data:", error);
      return [];
    }
  };

  // Load current price on mount
  useEffect(() => {
    const loadCurrentPrice = async () => {
      const data = await fetchMarketData(selectedCoin, selectedInterval, 1);
      if (data.length > 0) {
        setCurrentPrice(data[0].close);
      }
    };
    loadCurrentPrice();
  }, [selectedCoin, selectedInterval]);

  const handleIntervalChange = (interval: TimeInterval) => {
    setSelectedInterval(interval);
  };

  // Handle chart data updates to ensure simulation uses same data
  const handleChartDataUpdate = (candles: any[], vwapData?: VWAPData) => {
    console.log(
      `🔄 Chart data updated: ${candles.length} candles, VWAP: ${
        vwapData?.vwap?.toFixed(6) || "N/A"
      }${simulationActive ? " [SIMULATION USING LIVE DATA]" : ""}`
    );

    // Convert chart candle format to simulation format
    const simulationCandles = candles.map((candle) => ({
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      timestamp: candle.time * 1000, // Convert to milliseconds
    }));

    setChartCandles(simulationCandles);
    setChartVWAPData(vwapData);

    // Update current price from latest candle
    if (candles.length > 0) {
      setCurrentPrice(candles[candles.length - 1].close);
    }
  };

  const handleTokenChange = (token: string) => {
    setSelectedCoin(token);
  };

  const handleMarketTypeChange = (marketType: MarketType) => {
    setSelectedMarketType(marketType);
  };

  // Remove the getFullCoinSymbol function since we'll pass marketType separately

  const handleSimulationStart = async (config: TWAPConfig) => {
    console.log("🧪 Starting Real-Time VWAP Simulation with config:", config);

    setSimulationConfig(config);
    setSimulationActive(true);
    simulationActiveRef.current = true;
    setSimulationResults([]);
    setProgress(0);

    try {
      // Validate chart data is available
      if (chartCandles.length === 0) {
        alert("Please wait for chart data to load before starting simulation.");
        return;
      }

      // Convert to VWAPEnhancedConfig
      const vwapConfig: VWAPEnhancedConfig = {
        totalSize: config.totalSize,
        totalOrders: config.totalOrders,
        timeInterval: config.timeInterval,
        maxSlippagePercent: config.maxSlippage,
        vwapAlpha: config.vwapAlpha,
        maxMultiplier: config.maxMultiplier || 5.0,
        minMultiplier: config.minMultiplier || 0.1,
        vwapPeriod: 50,
        asset: config.asset,
        side: config.side.toLowerCase() as "buy" | "sell",
      };

      console.log("🧪 Starting Chart-Based VWAP Simulation...");
      console.log(
        `📊 Using chart data: ${chartCandles.length} candles, Current VWAP: ${
          chartVWAPData?.vwap?.toFixed(6) || "N/A"
        }`
      );

      // Start simulation using chart data
      await simulateRealTimeVWAP(vwapConfig);
    } catch (error) {
      console.error("❌ Simulation error:", error);
      alert(`Simulation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSimulationActive(false);
      simulationActiveRef.current = false;
    }
  };

  // Real-time simulation function
  const simulateRealTimeVWAP = async (config: VWAPEnhancedConfig) => {
    console.log(
      "🚀 SIMULATION STARTED - Asset:",
      config.asset,
      "Side:",
      config.side,
      "Size:",
      config.totalSize
    );

    let remainingShares = config.totalSize;
    let remainingOrders = config.totalOrders;
    let orderCount = 0;

    // Validate that chart data is available
    console.log("🔍 Using chart data for simulation...");
    if (chartCandles.length === 0) {
      throw new Error(
        "No chart data available. Please wait for chart to load before starting simulation."
      );
    }

    // Fetch asset metadata to get decimals for proper order size rounding
    let assetDecimals = 4; // Default fallback
    try {
      const assetInfo = await getMarketInfo(config.asset, !isTestnet()); // Use network setting

      // Explicit handling of szDecimals
      if (assetInfo.szDecimals !== undefined && assetInfo.szDecimals !== null) {
        assetDecimals = assetInfo.szDecimals;
      }

      console.log(`📊 Asset ${config.asset} has ${assetDecimals} decimals for order sizing`);
      console.log(
        `🔧 Order size rounding enabled: ${config.asset} requires ${assetDecimals} decimal places for Hyperliquid compliance`
      );

      // Set rounding info for UI display
      setAssetRoundingInfo({
        asset: config.asset,
        decimals: assetDecimals,
        roundingActive: true,
      });
    } catch (error) {
      console.warn(
        `⚠️ Could not fetch asset info for ${config.asset}, using default ${assetDecimals} decimals:`,
        error
      );
    }

    console.log(`🔍 Using ${chartCandles.length} candles from chart data`);
    const historicalData = chartCandles;

    if (historicalData.length === 0) {
      throw new Error("No historical data available for VWAP calculation");
    }

    // Initialize VWAP from the core algorithm
    const { initializeVWAP, updateVWAP, calculateVWAPOrderSize } = await import(
      "../../core/trade/vwapEnhancedTWAP"
    );
    let currentVWAPData = initializeVWAP(historicalData);

    console.log(
      `📈 Initialized VWAP: $${currentVWAPData.vwap.toFixed(6)} from ${
        historicalData.length
      } historical candles`
    );

    // Execute orders by iterating through chart data
    let orderIndex = 0;
    while (remainingOrders > 0 && remainingShares > 0 && orderIndex < historicalData.length) {
      // Check if simulation was stopped
      if (!simulationActiveRef.current) {
        console.log("Simulation stopped by user");
        break;
      }

      try {
        // Add realistic time delay between orders for market progression
        if (orderIndex > 0) {
          const delayMs = Math.max(config.timeInterval * 1000, 3000); // At least 3 seconds
          console.log(`⏱️ Waiting ${delayMs / 1000}s before order ${orderIndex + 1}...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        // Use chart data instead of fetching fresh data for each order
        // This prevents rate limiting and uses the live-updating chart data
        console.log(`� Using live chart data for order ${orderIndex + 1}...`);

        // Get the most current chart data using ref
        const currentChartCandles = chartCandlesRef.current;
        if (currentChartCandles.length === 0) {
          console.warn("⚠️ No chart data available - skipping order");
          orderIndex++;
          continue;
        }

        // Use the most recent candle from the chart data
        const currentCandle = currentChartCandles[currentChartCandles.length - 1];
        console.log(
          `📊 Live chart data for order ${orderIndex + 1}: Price=${currentCandle.close.toFixed(
            6
          )} (${currentChartCandles.length} candles available)`
        );

        // Use chart VWAP data consistently for all orders
        // This ensures the algorithm uses the same VWAP as displayed on the chart
        let currentVWAPData;
        const currentChartVWAP = chartVWAPDataRef.current;

        if (currentChartVWAP) {
          // Always use the chart's VWAP - it uses session-based calculation
          currentVWAPData = currentChartVWAP;
          console.log(`📊 Using chart VWAP (session-based): ${currentChartVWAP.vwap.toFixed(6)}`);
        } else {
          // Fallback: calculate session-based VWAP from current chart data
          console.log(
            `⚠️ No chart VWAP available, calculating session-based VWAP from chart data...`
          );

          // Find the current session start (daily reset at UTC midnight)
          const currentTime = currentChartCandles[currentChartCandles.length - 1].timestamp;
          const currentDate = new Date(currentTime);
          const sessionStartTime = new Date(currentDate);
          sessionStartTime.setUTCHours(0, 0, 0, 0); // Start of current UTC day

          // Filter candles from current session
          const sessionCandles = currentChartCandles.filter(
            (candle) => candle.timestamp >= sessionStartTime.getTime()
          );

          if (sessionCandles.length > 0) {
            currentVWAPData = initializeVWAP(sessionCandles);
            console.log(
              `📊 Calculated session VWAP from ${
                sessionCandles.length
              } session candles: ${currentVWAPData.vwap.toFixed(6)}`
            );
          } else {
            // Ultimate fallback: use all available data
            currentVWAPData = initializeVWAP(currentChartCandles);
            console.log(
              `📊 Fallback VWAP from all ${
                currentChartCandles.length
              } candles: ${currentVWAPData.vwap.toFixed(6)}`
            );
          }
        }

        console.log(
          `🔍 Debug - Current Price: $${currentCandle.close.toFixed(
            6
          )}, VWAP: $${currentVWAPData.vwap.toFixed(6)}, Chart Candles: ${
            currentChartCandles.length
          }`
        );

        // Calculate base order size
        const baseOrderSize = remainingShares / remainingOrders;

        // Apply VWAP-enhanced sizing
        const vwapSizing = calculateVWAPOrderSize(
          baseOrderSize,
          currentCandle.close,
          currentVWAPData.vwap,
          config.vwapAlpha,
          config.maxMultiplier,
          config.minMultiplier
        );

        console.log(
          `VWAP Sizing Result: ${vwapSizing.reasoning}, Multiplier: ${vwapSizing.multiplier.toFixed(
            4
          )}x, Base: ${baseOrderSize.toFixed(2)}, Adjusted: ${vwapSizing.adjustedSize.toFixed(2)}`
        );
        console.log(
          `📊 Config Parameters: Alpha=${config.vwapAlpha}, MaxMult=${config.maxMultiplier}, MinMult=${config.minMultiplier}`
        );

        // Ensure we don't exceed remaining shares
        const finalOrderSizeBeforeRounding = Math.min(vwapSizing.adjustedSize, remainingShares);

        // Round order size according to asset decimals (crucial for Hyperliquid compliance)
        // PURR has 0 decimals, so sizes must be whole numbers
        const finalOrderSize = roundOrderSizeForAsset(finalOrderSizeBeforeRounding, assetDecimals);

        console.log(
          `🔧 Order ${orderIndex + 1} Size Rounding: ${finalOrderSizeBeforeRounding.toFixed(
            6
          )} → ${finalOrderSize} (${assetDecimals} decimals)`
        );

        // Fetch real orderbook for accurate slippage calculation
        console.log(`📊 Fetching orderbook for ${selectedCoin} to calculate slippage...`);
        const orderBook = await fetchOrderBook(selectedCoin, false); // Use mainnet

        let actualSize: number;
        let executionPrice: number;
        let slippagePercent: number;
        let executionStatus: "executed" | "partial" | "rejected";

        if (orderBook) {
          // Use real orderbook slippage calculation
          const isBuy = config.side.toLowerCase() === "buy";
          const slippageInfo = calculateSlippage(orderBook, finalOrderSize, isBuy);

          const maxSlippage = config.maxSlippagePercent || 2.0;

          if (!slippageInfo.wouldExecute) {
            // Order cannot be executed due to insufficient liquidity
            executionStatus = "rejected";
            actualSize = 0;
            executionPrice = currentCandle.close;
            slippagePercent = 100;
          } else if (slippageInfo.slippagePercent <= maxSlippage) {
            // Order executes fully within slippage tolerance
            executionStatus = "executed";
            actualSize = finalOrderSize;
            executionPrice = currentCandle.close; // Use actual market price, not slippage-adjusted
            slippagePercent = slippageInfo.slippagePercent;
          } else {
            // Partial execution - find maximum size that fits within slippage tolerance
            const volumeConstraints = checkVolumeConstraints(
              orderBook,
              finalOrderSize,
              isBuy,
              maxSlippage
            );

            if (volumeConstraints.canHandle) {
              // This shouldn't happen but handle it
              executionStatus = "executed";
              actualSize = finalOrderSize;
              executionPrice = currentCandle.close; // Use actual market price
              slippagePercent = slippageInfo.slippagePercent;
            } else {
              // Partial execution with maximum allowed size
              const maxAllowedSize = volumeConstraints.suggestedMaxVolume || finalOrderSize * 0.3;
              const actualSizeBeforeRounding = Math.min(maxAllowedSize, finalOrderSize);

              // Apply asset decimal rounding to ensure compliance with Hyperliquid order size rules
              actualSize = roundOrderSizeForAsset(actualSizeBeforeRounding, assetDecimals);

              console.log(
                `🛡️ Partial Execution Rounding: ${actualSizeBeforeRounding.toFixed(
                  6
                )} → ${actualSize} (${assetDecimals} decimals)`
              );

              if (actualSize > 0) {
                const partialSlippageInfo = calculateSlippage(orderBook, actualSize, isBuy);
                executionStatus = "partial";
                executionPrice = currentCandle.close; // Use actual market price
                slippagePercent = partialSlippageInfo.slippagePercent;
              } else {
                executionStatus = "rejected";
                actualSize = 0;
                executionPrice = currentCandle.close;
                slippagePercent = 100;
              }
            }
          }
        } else {
          // Fallback to simplified calculation if orderbook unavailable
          console.warn("Orderbook unavailable, using fallback slippage calculation");
          const marketImpact = (finalOrderSize / (currentCandle.volume || 1000)) * 100;
          const baseSlippage = Math.random() * 0.3; // 0-0.3% base slippage
          const impactSlippage = marketImpact > 2 ? (marketImpact - 2) * 0.05 : 0;
          const totalSlippage = baseSlippage + impactSlippage;

          const maxSlippage = config.maxSlippagePercent || 2.0;

          if (totalSlippage <= maxSlippage && marketImpact <= 5.0) {
            executionStatus = "executed";
            actualSize = finalOrderSize;
            slippagePercent = totalSlippage;
          } else {
            // Dynamic partial fill based on slippage tolerance
            const slippageRatio = Math.min(maxSlippage / totalSlippage, 1.0);
            const actualSizeBeforeRounding = finalOrderSize * slippageRatio;

            // Apply asset decimal rounding to ensure compliance with Hyperliquid order size rules
            actualSize = roundOrderSizeForAsset(actualSizeBeforeRounding, assetDecimals);

            console.log(
              `🛡️ Fallback Slippage Rounding: ${actualSizeBeforeRounding.toFixed(
                6
              )} → ${actualSize} (${assetDecimals} decimals)`
            );

            executionStatus = actualSize >= finalOrderSize * 0.8 ? "partial" : "rejected";
            slippagePercent = actualSize > 0 ? totalSlippage * slippageRatio : totalSlippage;
          }

          executionPrice = currentCandle.close * (1 + slippagePercent / 100);
        }

        // Create order result
        const orderResult: VWAPSimulationResult = {
          orderId: `LIVE_VWAP_${Date.now()}_${orderIndex}`,
          timestamp: new Date().toISOString(),
          shares: actualSize,
          price: executionPrice,
          vwap: currentVWAPData.vwap,
          multiplier: vwapSizing.multiplier,
          slippage: slippagePercent / 100,
          status: executionStatus,
          reasoning: vwapSizing.reasoning,
        };

        console.log(
          `📈 Order ${orderIndex + 1}: ${actualSize.toFixed(2)} @ $${executionPrice.toFixed(
            6
          )} | VWAP: $${currentVWAPData.vwap.toFixed(6)} | Slippage: ${slippagePercent.toFixed(
            3
          )}% | Status: ${executionStatus} | ${vwapSizing.reasoning}`
        );

        // Add order to results in real-time
        setSimulationResults((prev) => [...prev, orderResult]);

        // Update remaining quantities based on execution status
        if (executionStatus === "executed" || executionStatus === "partial") {
          // Only update remaining shares and orders for successful executions
          remainingShares -= actualSize;
          remainingOrders -= 1;
          orderIndex++; // Move to next candle only on successful execution
        } else {
          // For rejected orders, try the same candle again but don't decrement remainingOrders
          console.log(`⚠️ Order ${orderIndex + 1} rejected - retrying with same candle`);
          orderIndex++; // Still move to next candle to avoid infinite loop
        }
        orderCount++;

        // If this was a partial execution, we need to distribute the unexecuted portion
        // across the remaining orders to maintain the total target size
        const unexecutedSize = finalOrderSize - actualSize;
        if (unexecutedSize > 0 && remainingOrders > 0) {
          // Redistribute unexecuted size across remaining orders
          console.log(
            `⚠️ Partial execution: ${unexecutedSize.toFixed(
              2
            )} shares redistributed to ${remainingOrders} remaining orders`
          );
          // Note: remainingShares already accounts for this since we only subtract actualSize
        }

        // Update progress
        setProgress((orderCount / config.totalOrders) * 100);

        // Wait for the configured time interval + rate limiting delay
        const minDelay = Math.max(config.timeInterval * 1000, 3000); // Minimum 3 seconds between orders
        console.log(
          `⏱️ Waiting ${
            minDelay / 1000
          } seconds before next order (rate limiting + time interval)...`
        );
        await new Promise((resolve) => setTimeout(resolve, minDelay));
      } catch (error) {
        console.error(`❌ Error executing order ${orderIndex + 1}:`, error);
        // Continue with next order
        orderIndex++;

        // Add extra delay on error to prevent rate limit spiral
        console.log(`⏱️ Error delay: waiting 5 seconds before retry...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    console.log(`✅ Real-time VWAP simulation completed: ${orderCount} orders executed`);
  };

  const handleStopSimulation = () => {
    console.log("🛑 Stopping VWAP Simulation");
    setSimulationActive(false);
    simulationActiveRef.current = false;
    setAssetRoundingInfo(null);
  };

  const resetSimulation = () => {
    setSimulationActive(false);
    simulationActiveRef.current = false;
    setSimulationConfig(null);
    setSimulationResults([]);
    setProgress(0);
    setAssetRoundingInfo(null);
  };

  // Calculate performance metrics using the core algorithm
  const performanceMetrics = calculateVWAPPerformance(
    simulationResults,
    simulationConfig
      ? {
          totalSize: simulationConfig.totalSize,
          totalOrders: simulationConfig.totalOrders,
        }
      : undefined
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <Navigation />

      {/* Main Layout: Chart | Configuration */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Chart Section - 4/5 width */}
        <div className="flex-1 w-4/5 flex flex-col">
          {/* Chart - Top Half */}
          <div className="flex-1 p-4 pb-2">
            <CandleChart
              coin={selectedCoin}
              interval={selectedInterval}
              onIntervalChange={handleIntervalChange}
              showVWAP={true}
              vwapPeriod={20}
              onDataUpdate={handleChartDataUpdate}
              network="mainnet"
              marketType={selectedMarketType}
            />
          </div>

          {/* Simulation Results - Bottom Half */}
          <div className="h-1/2 p-4 pt-2">
            <div className="bg-gray-900 rounded-lg p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Simulation Results</h2>

                <div className="flex items-center space-x-4">
                  {simulationActive && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-blue-400 text-sm font-medium">Simulation Running</span>
                      <button
                        onClick={handleStopSimulation}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                  )}
                  <div className="text-sm text-gray-400">
                    Live Market Data • Real-Time Simulation
                  </div>
                  {simulationConfig && (
                    <button
                      onClick={resetSimulation}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {simulationConfig ? (
                <div className="space-y-4 h-full flex flex-col">
                  {/* Progress Bar */}
                  {simulationActive && (
                    <div className="bg-blue-900/20 border border-blue-500 rounded p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-blue-400 text-sm font-medium">
                          Real-Time Simulation Active
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-gray-400">Live Data</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress: {Math.round(progress)}%</span>
                        <span>
                          {simulationResults.length} / {simulationConfig?.totalOrders || 0} orders
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Asset Rounding Information */}
                  {assetRoundingInfo && (
                    <div className="bg-amber-900/20 border border-amber-500 rounded p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
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
                        <div className="text-gray-400">
                          {assetRoundingInfo.decimals === 0
                            ? "Example: 1.008672 → 1"
                            : `Example: 1.008672 → ${(1.008672).toFixed(
                                assetRoundingInfo.decimals
                              )}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  {simulationResults.length > 0 && performanceMetrics && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">Total Executed</p>
                        <p className="text-lg font-bold text-white">
                          {performanceMetrics.totalExecuted.toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">VWAP Performance</p>
                        <p
                          className={`text-lg font-bold ${
                            performanceMetrics.vwapPerformance < 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {performanceMetrics.vwapPerformance.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">Execution Rate</p>
                        <p className="text-lg font-bold text-blue-400">
                          {performanceMetrics.executionRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Algorithm Comparison Metrics */}
                  {simulationResults.length > 0 && performanceMetrics && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">VWAP-Enhanced Avg Price</p>
                        <p className="text-lg font-bold text-cyan-400">
                          ${performanceMetrics.vwapEnhancedAvgPrice.toFixed(6)}
                        </p>
                      </div>
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">Standard TWAP Avg Price</p>
                        <p className="text-lg font-bold text-orange-400">
                          ${performanceMetrics.standardTWAPAvgPrice.toFixed(6)}
                        </p>
                      </div>
                      <div className="bg-gray-800 p-3 rounded">
                        <p className="text-xs text-gray-400">Avg Slippage</p>
                        <p className="text-lg font-bold text-yellow-400">
                          {(performanceMetrics.averageSlippage * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Orders Table */}
                  <div className="flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-900">
                          <tr className="border-b border-gray-700">
                            <th className="text-left p-2 text-gray-400">Order ID</th>
                            <th className="text-left p-2 text-gray-400">Time</th>
                            <th className="text-left p-2 text-gray-400">Shares</th>
                            <th className="text-left p-2 text-gray-400">Price</th>
                            <th className="text-left p-2 text-gray-400">VWAP</th>
                            <th className="text-left p-2 text-gray-400">Multiplier</th>
                            <th className="text-left p-2 text-gray-400">Slippage</th>
                            <th className="text-left p-2 text-gray-400">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simulationResults
                            .slice()
                            .reverse()
                            .map((result, index) => (
                              <tr
                                key={index}
                                className="border-b border-gray-700 hover:bg-gray-800"
                              >
                                <td className="p-2 text-blue-400">{result.orderId}</td>
                                <td className="p-2 text-gray-300">
                                  {new Date(result.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="p-2 text-white font-mono">
                                  <div className="flex items-center space-x-1">
                                    <span>
                                      {Math.abs(result.shares - Math.round(result.shares)) < 0.0001
                                        ? Math.round(result.shares).toString()
                                        : result.shares.toFixed(6)}
                                    </span>
                                    {assetRoundingInfo &&
                                      Math.abs(result.shares - Math.round(result.shares)) <
                                        0.0001 &&
                                      assetRoundingInfo.decimals === 0 && (
                                        <span
                                          className="text-amber-400 text-xs"
                                          title="Order size rounded for Hyperliquid compliance"
                                        ></span>
                                      )}
                                  </div>
                                </td>
                                <td className="p-2 text-white font-mono">
                                  ${result.price.toFixed(6)}
                                </td>
                                <td className="p-2 text-green-400 font-mono">
                                  ${result.vwap.toFixed(6)}
                                </td>
                                <td className="p-2 text-yellow-400 font-mono">
                                  {result.multiplier.toFixed(3)}x
                                </td>
                                <td className="p-2 text-red-400 font-mono">
                                  {(result.slippage * 100).toFixed(3)}%
                                </td>
                                <td className="p-2">
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      result.status === "executed"
                                        ? "bg-green-600 text-white"
                                        : result.status === "rejected"
                                        ? "bg-red-600 text-white"
                                        : "bg-yellow-600 text-white"
                                    }`}
                                  >
                                    {result.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>

                      {simulationResults.length === 0 && !simulationActive && (
                        <div className="flex items-center justify-center h-32">
                          <div className="text-center text-gray-400">
                            <div className="text-4xl mb-2">🧪</div>
                            <p className="text-sm">
                              Configure and start a simulation to see results
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <div className="text-4xl mb-4">🧪</div>
                    <h3 className="text-lg font-medium mb-2">VWAP Simulation Ready</h3>
                    <p className="text-sm">Configure VWAP strategy settings and start simulation</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Configuration Section - 1/5 width */}
        <div className="w-1/5 border-l border-gray-800 p-4 space-y-4">
          {/* VWAP Strategy Configuration */}
          <div>
            <h2 className="text-lg font-bold text-blue-400 mb-2">VWAP Strategy Configuration</h2>
            {currentPrice && (
              <div className="p-3 bg-gray-800 rounded mb-4">
                <p className="text-sm text-gray-400">Current Price</p>
                <p className="text-lg font-bold text-green-400">${currentPrice.toFixed(6)}</p>
              </div>
            )}
          </div>

          {/* Order Configuration - Available for everyone */}
          <OrderConfiguration
            onConfigSubmit={handleSimulationStart}
            currentPrice={currentPrice}
            isSimulation={true}
            selectedToken={selectedCoin}
            selectedMarketType={selectedMarketType}
            onTokenChange={handleTokenChange}
            onMarketTypeChange={handleMarketTypeChange}
            isExecuting={simulationActive}
            walletReady={true} // Simulation doesn't require wallet
          />
        </div>
      </div>
    </div>
  );
}
