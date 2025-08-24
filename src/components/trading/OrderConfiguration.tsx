"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import TokenSelector from "./TokenSelector";
import MarketTypeSelector, { MarketType } from "./MarketTypeSelector";
import { useNetwork } from "@/contexts/NetworkContext";

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
  timeInterval: number; // seconds between orders
  vwapPeriod: number; // number of candles for VWAP calculation
  marketType: MarketType; // PERP or SPOT
}

interface OrderConfigurationProps {
  onConfigSubmit: (config: TWAPConfig) => void;
  onStopTWAP?: () => void;
  currentPrice?: number;
  isSimulation?: boolean;
  selectedToken: string;
  selectedMarketType: MarketType;
  onTokenChange: (token: string) => void;
  onMarketTypeChange: (marketType: MarketType) => void;
  isExecuting?: boolean;
  walletReady?: boolean;
  assetRoundingInfo?: {
    asset: string;
    decimals: number;
    example: string;
  } | null;
}

export default function OrderConfiguration({
  onConfigSubmit,
  onStopTWAP,
  currentPrice,
  isSimulation = false,
  selectedToken,
  selectedMarketType,
  onTokenChange,
  onMarketTypeChange,
  isExecuting = false,
  walletReady = true,
  assetRoundingInfo,
}: OrderConfigurationProps) {
  const [isAdvanced, setIsAdvanced] = useState(false);
  const { isTestnet } = useNetwork();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<TWAPConfig>({
    defaultValues: {
      asset: selectedToken,
      side: "BUY",
      totalSize: 1000,
      totalOrders: 10, // Reduced for realistic real-time execution
      maxSlippage: 2.0,
      vwapAlpha: 0.5,
      minMultiplier: 0.5,
      maxMultiplier: 2.0,
      maxParticipation: 5.0,
      timeInterval: 5, // Minimum 5 seconds to respect rate limits
      vwapPeriod: 20,
      marketType: selectedMarketType,
    },
  });

  // Update fields when external selections change
  useEffect(() => {
    setValue("asset", selectedToken);
    setValue("marketType", selectedMarketType);
  }, [selectedToken, selectedMarketType, setValue]);

  const watchedValues = watch();
  const estimatedOrderSize = watchedValues.totalSize / watchedValues.totalOrders;
  const estimatedCost = currentPrice ? watchedValues.totalSize * currentPrice : 0;
  const estimatedDuration = (watchedValues.totalOrders * watchedValues.timeInterval) / 60; // minutes

  const onSubmit = (data: TWAPConfig) => {
    console.log("📋 Form submitted with data:", data);
    console.log(
      "🎯 Form submission triggered - this should only happen when clicking the Start button"
    );

    // Ensure we use the current selections
    const configWithSelections = {
      ...data,
      asset: selectedToken,
      marketType: selectedMarketType,
    };

    // Add confirmation for live trading
    if (!isSimulation) {
      const estimatedCost = currentPrice ? data.totalSize * currentPrice : 0;
      const confirmMessage =
        `⚠️ LIVE TRADING CONFIRMATION ⚠️\n\n` +
        `Asset: ${configWithSelections.asset}\n` +
        `Side: ${configWithSelections.side}\n` +
        `Total Size: ${configWithSelections.totalSize}\n` +
        `Total Orders: ${configWithSelections.totalOrders}\n` +
        `Estimated Cost: $${estimatedCost.toFixed(2)}\n` +
        `Network: ${isTestnet() ? "TESTNET" : "MAINNET"}\n\n` +
        `Are you sure you want to start live TWAP execution?`;

      if (!confirm(confirmMessage)) {
        console.log("❌ User cancelled live TWAP execution");
        return; // User cancelled
      }
    }

    console.log("✅ Submitting configuration:", configWithSelections);
    onConfigSubmit(configWithSelections);
  };

  const presetConfigs = [
    {
      name: "Conservative",
      config: {
        maxSlippage: 1.0,
        vwapAlpha: 0.3,
        maxParticipation: 3.0,
        timeInterval: 10, // 10 seconds - slower execution
        vwapPeriod: 30,
      },
    },
    {
      name: "Balanced",
      config: {
        maxSlippage: 2.0,
        vwapAlpha: 0.5,
        maxParticipation: 5.0,
        timeInterval: 5, // 5 seconds - balanced execution
        vwapPeriod: 20,
      },
    },
    {
      name: "Aggressive",
      config: {
        maxSlippage: 5.0,
        vwapAlpha: 0.8,
        maxParticipation: 10.0,
        timeInterval: 3, // 3 seconds - faster execution (will be capped to 3s minimum)
        vwapPeriod: 10,
      },
    },
  ];

  const applyPreset = (preset: { name: string; config: Partial<TWAPConfig> }) => {
    Object.entries(preset.config).forEach(([key, value]) => {
      if (value !== undefined) {
        setValue(key as keyof TWAPConfig, value);
      }
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-4">TWAP Configuration</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Token and Market Type Selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset Selection</label>
            <TokenSelector
              selectedToken={selectedToken}
              onTokenChange={onTokenChange}
              network={isTestnet() ? "testnet" : "mainnet"}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Market Type</label>
              {assetRoundingInfo && (
                <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <span className="text-amber-600 font-medium">
                    {assetRoundingInfo.decimals === 0
                      ? "Whole numbers"
                      : `${assetRoundingInfo.decimals} decimals`}
                  </span>
                </div>
              )}
            </div>
            <MarketTypeSelector
              selectedType={selectedMarketType}
              onTypeChange={onMarketTypeChange}
            />
          </div>
        </div>

        {/* Basic Configuration */}
        <div className="space-y-4">
          {/* Side Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Side</label>
            <select
              {...register("side")}
              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          {/* Size & Orders */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Size</label>
              <input
                type="number"
                {...register("totalSize", { required: "Total size is required", min: 1 })}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1000"
              />
              {errors.totalSize && (
                <p className="text-red-500 text-xs mt-1">{errors.totalSize.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Orders</label>
              <input
                type="number"
                {...register("totalOrders", { required: "Total orders is required", min: 1 })}
                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
              {errors.totalOrders && (
                <p className="text-red-500 text-xs mt-1">{errors.totalOrders.message}</p>
              )}
            </div>
          </div>

          {/* Max Slippage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Slippage (%)</label>
            <input
              type="number"
              step="0.1"
              {...register("maxSlippage", { required: "Max slippage is required", min: 0.1 })}
              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="2.0"
            />
            {errors.maxSlippage && (
              <p className="text-red-500 text-xs mt-1">{errors.maxSlippage.message}</p>
            )}
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Presets</label>
          <div className="grid grid-cols-3 gap-2">
            {presetConfigs.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-3 py-2 bg-blue-400 hover:bg-blue-500 text-white rounded text-sm transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="advanced"
            checked={isAdvanced}
            onChange={(e) => setIsAdvanced(e.target.checked)}
            className="mr-2 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="advanced" className="text-sm text-gray-700">
            Advanced Settings
          </label>
        </div>

        {/* Advanced Configuration */}
        {isAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VWAP Alpha</label>
                <input
                  type="number"
                  step="0.1"
                  {...register("vwapAlpha")}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VWAP Period (candles)
                </label>
                <input
                  type="number"
                  {...register("vwapPeriod")}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Interval (s)
                </label>
                <input
                  type="number"
                  {...register("timeInterval")}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Slippage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register("maxSlippage")}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register("minMultiplier")}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register("maxMultiplier")}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {!isSimulation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Market Participation (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register("maxParticipation")}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Estimation Panel */}
        <div className="bg-gray-50 border border-gray-200 rounded p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Order Estimation</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Avg Order Size</div>
              <div className="text-gray-900 font-mono">{estimatedOrderSize.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-600">Est. Duration</div>
              <div className="text-gray-900 font-mono">{estimatedDuration.toFixed(1)}m</div>
            </div>
            {currentPrice && (
              <>
                <div>
                  <div className="text-gray-600">Current Price</div>
                  <div className="text-gray-900 font-mono">${currentPrice.toFixed(6)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Est. Total Cost</div>
                  <div className="text-gray-900 font-mono">${estimatedCost.toFixed(2)}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isExecuting || (!walletReady && !isSimulation)}
          className={`w-full font-medium py-3 px-4 rounded transition-colors ${
            isExecuting
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : !walletReady && !isSimulation
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : isSimulation
              ? "bg-blue-400 hover:bg-blue-500 text-white"
              : "bg-green-500 hover:bg-green-600 text-white"
          }`}
        >
          {isExecuting
            ? "🔄 Executing TWAP..."
            : !walletReady && !isSimulation
            ? "🔐 Connect Wallet & Authorize Agent"
            : isSimulation
            ? "🧪 Start Simulation"
            : "🚀 Start Live TWAP Execution"}
        </button>

        {/* Warning note for live trading */}
        {!isSimulation && !isExecuting && (
          <p className="text-xs text-yellow-600 mt-2 text-center">
            ⚠️ Clicking &quot;Start Live TWAP Execution&quot; will begin real trading with real
            funds
          </p>
        )}

        {/* Stop Button (only show when executing and not simulation) */}
        {isExecuting && !isSimulation && onStopTWAP && (
          <button
            type="button"
            onClick={onStopTWAP}
            className="w-full font-medium py-2 px-4 rounded transition-colors bg-red-500 hover:bg-red-600 text-white mt-2"
          >
            🛑 Stop TWAP Execution
          </button>
        )}
      </form>
    </div>
  );
}
