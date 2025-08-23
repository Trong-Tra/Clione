"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { initializeVWAP, updateVWAP, VWAPData } from "@/core/trade/vwapEnhancedTWAP";
import { MarketType } from "./MarketTypeSelector";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TimeInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface CandleChartProps {
  coin: string;
  interval: TimeInterval;
  onIntervalChange: (interval: TimeInterval) => void;
  showVWAP?: boolean;
  vwapPeriod?: number;
  onDataUpdate?: (candles: Candle[], vwapData?: VWAPData) => void;
  network?: "mainnet" | "testnet";
  marketType?: MarketType; // Add market type prop
}

export default function CandleChart({
  coin,
  interval,
  onIntervalChange,
  showVWAP = true,
  vwapPeriod = 20,
  onDataUpdate,
  network = "mainnet", // Default to mainnet for backward compatibility
  marketType = "PERP", // Default to PERP
}: CandleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const vwapSeriesRef = useRef<any>(null);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [currentVWAP, setCurrentVWAP] = useState<number | null>(null);

  const intervals: { value: TimeInterval; label: string }[] = [
    { value: "1m", label: "1m" },
    { value: "5m", label: "5m" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "4h", label: "4h" },
    { value: "1d", label: "1d" },
  ];

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1a1a1a" },
        textColor: "#d1d5db",
      },
      grid: {
        vertLines: { color: "#374151" },
        horzLines: { color: "#374151" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#485563",
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: "#485563",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Main candlestick series - using correct v5 syntax
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00d4aa",
      downColor: "#ff4976",
      borderDownColor: "#ff4976",
      borderUpColor: "#00d4aa",
      wickDownColor: "#ff4976",
      wickUpColor: "#00d4aa",
    });

    // Volume series - using correct v5 syntax
    const volumeSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // VWAP line series
    let vwapSeries = null;
    if (showVWAP) {
      vwapSeries = chart.addLineSeries({
        color: "#ffeb3b",
        lineWidth: 3,
        title: `VWAP (${vwapPeriod})`,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        priceScaleId: "right", // Ensure it's on the main price scale
      });
      console.log(`🔍 VWAP series created with period ${vwapPeriod}`);
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    vwapSeriesRef.current = vwapSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  const [lastFetchTime, setLastFetchTime] = useState(0);
  const MIN_FETCH_INTERVAL = 2000; // Minimum 2 seconds between fetches

  // Fetch candle data with rate limiting
  const fetchCandles = useCallback(
    async (newInterval: TimeInterval) => {
      const now = Date.now();
      if (now - lastFetchTime < MIN_FETCH_INTERVAL) {
        console.log(
          `🔒 Rate limiting: skipping fetch (last fetch ${Math.round(
            (now - lastFetchTime) / 1000
          )}s ago)`
        );
        return;
      }

      console.log(`🔍 fetchCandles called: coin=${coin}, interval=${newInterval}`);
      setLoading(true);
      setError(null);
      setLastFetchTime(now);

      try {
        const response = await fetch(
          `/api/candles?coin=${coin}&interval=${newInterval}&count=200&network=${network}&marketType=${marketType}`
        );
        console.log(
          `📡 API request: /api/candles?coin=${coin}&interval=${newInterval}&count=200&network=${network}&marketType=${marketType}`
        );

        if (!response.ok) {
          console.error(`API Error: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.error(`Error details: ${errorText}`);
          throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch candles");
        }

        const candleData = result.data;
        setCandles(candleData);

        if (candleData.length > 0) {
          setLastPrice(candleData[candleData.length - 1].close);
        }

        // Calculate VWAP data if enabled
        let vwapData: Array<{ time: number; value: number }> = [];
        if (showVWAP && candleData.length > 0) {
          console.log(
            `🔍 Calculating Daily Session VWAP for ${candleData.length} candles (matching Hyperliquid)`
          );

          // Find session boundaries (daily resets at UTC midnight)
          const sessionStarts: number[] = [];
          let lastSessionDay = -1;

          candleData.forEach((candle: Candle, i: number) => {
            const candleDate = new Date(candle.time * 1000);
            const currentDay = candleDate.getUTCDate();

            if (currentDay !== lastSessionDay) {
              sessionStarts.push(i);
              lastSessionDay = currentDay;
              console.log(`🔍 Session start at candle ${i}: ${candleDate.toISOString()}`);
            }
          });

          console.log(`🔍 Found ${sessionStarts.length} trading sessions`);

          // Calculate VWAP with daily session resets
          let sessionStartIndex = 0;

          for (let i = 0; i < candleData.length; i++) {
            // Check if we need to start a new session
            if (sessionStarts.includes(i) && i > 0) {
              sessionStartIndex = i;
              console.log(`🔍 Starting new VWAP session at candle ${i}`);
            }

            // Calculate VWAP from current session start to current candle
            let cumulativePV = 0;
            let cumulativeVolume = 0;

            for (let j = sessionStartIndex; j <= i; j++) {
              const candle = candleData[j];
              const hlc3 = (candle.high + candle.low + candle.close) / 3;
              const pv = hlc3 * candle.volume;
              cumulativePV += pv;
              cumulativeVolume += candle.volume;
            }

            const vwapValue =
              cumulativeVolume > 0
                ? cumulativePV / cumulativeVolume
                : (candleData[i].high + candleData[i].low + candleData[i].close) / 3;

            vwapData.push({
              time: candleData[i].time,
              value: vwapValue,
            });

            // Debug key points
            if (i < 3 || i >= candleData.length - 3 || sessionStarts.includes(i)) {
              const candle = candleData[i];
              const hlc3 = (candle.high + candle.low + candle.close) / 3;
              console.log(
                `🔍 Candle ${i}: Session[${sessionStartIndex}-${i}], HLC3=${hlc3.toFixed(
                  6
                )}, VWAP=${vwapValue.toFixed(6)}, CumVol=${cumulativeVolume.toFixed(2)}`
              );
            }
          }

          // Set current VWAP for display
          if (vwapData.length > 0) {
            setCurrentVWAP(vwapData[vwapData.length - 1].value);
            console.log(
              `🔍 Final Daily Session VWAP: ${vwapData[vwapData.length - 1].value.toFixed(6)}`
            );
          }
        }

        // Notify parent component of data update
        if (onDataUpdate) {
          const vwapDataObj =
            vwapData.length > 0
              ? {
                  vwap: vwapData[vwapData.length - 1].value,
                  volume: candleData.reduce((sum: number, c: Candle) => sum + c.volume, 0),
                  cumulativeVolume: candleData.reduce(
                    (sum: number, c: Candle) => sum + c.volume,
                    0
                  ),
                  cumulativePV: candleData.reduce(
                    (sum: number, c: Candle) => sum + ((c.high + c.low + c.close) / 3) * c.volume,
                    0
                  ),
                  lastUpdated: Date.now(),
                }
              : undefined;
          onDataUpdate(candleData, vwapDataObj);
        }

        // Update chart series
        if (candleSeriesRef.current && volumeSeriesRef.current) {
          candleSeriesRef.current.setData(candleData);

          const volumeData = candleData.map((candle: Candle) => ({
            time: candle.time,
            value: candle.volume,
            color: candle.close >= candle.open ? "#00d4aa40" : "#ff497640",
          }));

          volumeSeriesRef.current.setData(volumeData);

          // Update VWAP series if enabled
          if (vwapSeriesRef.current && vwapData.length > 0) {
            console.log(`🔍 Setting VWAP series data with ${vwapData.length} points`);
            console.log(`🔍 First VWAP point:`, vwapData[0]);
            console.log(`🔍 Last VWAP point:`, vwapData[vwapData.length - 1]);
            vwapSeriesRef.current.setData(vwapData);
          } else if (showVWAP) {
            console.warn(
              `🔍 VWAP series or data issue: series=${!!vwapSeriesRef.current}, dataLength=${
                vwapData.length
              }`
            );
          }

          // Auto-fit the chart to show all data optimally
          if (chartRef.current && candleData.length > 0) {
            // Set visible range to show all data with a small margin
            const firstTime = candleData[0].time;
            const lastTime = candleData[candleData.length - 1].time;
            const timeRange = lastTime - firstTime;
            const margin = timeRange * 0.05; // 5% margin on each side

            chartRef.current.timeScale().setVisibleRange({
              from: firstTime - margin,
              to: lastTime + margin,
            });

            // Auto-scale the price to fit the visible data perfectly
            chartRef.current.timeScale().fitContent();
          }
        }

        console.log(`📊 Loaded ${candleData.length} ${newInterval} candles for ${coin}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error fetching candles:", errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [coin, showVWAP, vwapPeriod, onDataUpdate, lastFetchTime, network, marketType]
  ); // Added lastFetchTime dependency

  // Initial data load and interval changes
  useEffect(() => {
    fetchCandles(interval);
  }, [fetchCandles, interval]);

  // Auto-refresh every 3 seconds for real-time updates
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log("🔄 Auto-refreshing chart data...");
      fetchCandles(interval);
    }, 3000); // 3 second intervals

    return () => clearInterval(refreshInterval);
  }, [fetchCandles, interval]);

  const handleIntervalClick = (newInterval: TimeInterval) => {
    if (newInterval !== interval) {
      onIntervalChange(newInterval);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-white">{coin}/USDC</h2>
          {lastPrice && (
            <div className="text-2xl font-mono text-green-400">${lastPrice.toFixed(6)}</div>
          )}
          {showVWAP && currentVWAP && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">VWAP({vwapPeriod}):</span>
              <div className="text-lg font-mono text-yellow-400">${currentVWAP.toFixed(6)}</div>
            </div>
          )}
          {loading && <div className="text-blue-400 text-sm">Loading...</div>}
        </div>

        {/* Interval Selector */}
        <div className="flex space-x-1">
          {intervals.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleIntervalClick(value)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                value === interval
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Chart Container */}
      <div className="relative">
        <div
          ref={chartContainerRef}
          className="w-full rounded border border-gray-700"
          style={{ height: "500px" }}
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded">
            <div className="text-white">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-2"></div>
              <div>Loading {interval} candles...</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Candles</div>
          <div className="text-white font-mono">{candles.length}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Interval</div>
          <div className="text-white font-mono">{interval}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Last Update</div>
          <div className="text-white font-mono">
            {candles.length > 0 ? new Date().toLocaleTimeString() : "-"}
          </div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Source</div>
          <div className="text-green-400 font-mono">Mainnet</div>
        </div>
      </div>
    </div>
  );
}
