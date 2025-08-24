"use client";

import Image from "next/image";
import Navigation from "@/components/Navigation";

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header with Logo */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <Image 
              src="/logo.png" 
              alt="ShieldTWAP Logo" 
              width={128}
              height={128}
              className="mx-auto rounded-lg"
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Clione – Trading with the Rhythm of the Market
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A sophisticated VWAP-Enhanced TWAP algorithm that combines elegant execution with
            adaptive market flow.
          </p>
        </div>

        {/* Clione Story */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 border border-blue-200">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                The Sea Angel&apos;s Wisdom
              </h2>

              <div className="prose prose-lg text-gray-700 space-y-4">
                <p>
                  In the deep ocean, the <strong>Clione</strong>, also known as the sea angel,
                  survives not through brute force but through adaptability and elegance. It rides
                  the currents, conserving energy, moving with precision, and striking only when the
                  moment is right.
                </p>

                <p>
                  Inspired by this, <strong>Clione</strong> is a trading execution tool built to
                  navigate the turbulent seas of financial markets. Instead of rushing headlong, it
                  executes orders with measured rhythm (TWAP) while adapting to the market&apos;s natural
                  flow (VWAP).
                </p>

                <p>
                  Every slice of the order is calculated not only by time but also by volume,
                  ensuring that execution feels less like a rigid schedule and more like a trader
                  moving in harmony with the market.
                </p>

                <p className="text-center italic text-blue-800 font-medium">
                  Just as the sea angel thrives in harsh and unpredictable waters, Clione helps
                  traders execute large orders smoothly, discreetly, and intelligently — swimming
                  with the tides rather than fighting against them.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mathematical Foundation */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Mathematical Foundation</h2>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Core Algorithm</h3>
            <p className="text-gray-700 mb-4">
              Our VWAP-Enhanced TWAP algorithm dynamically adjusts order volumes based on the price
              deviation from the Volume Weighted Average Price (VWAP). The mathematical formulation
              is:
            </p>

            <div className="bg-gray-50 rounded p-4 font-mono text-sm mb-4">
              <div className="mb-2">
                <strong>VWAP Calculation (HLC3 Session-based):</strong>
              </div>
              <div className="mb-4 flex items-center">
                VWAP =
                <div className="mx-2 text-center">
                  <div className="border-b border-gray-700">Σᵢ HLC3ᵢ × Volumeᵢ</div>
                  <div>Σᵢ Volumeᵢ</div>
                </div>
              </div>

              <div className="mb-2">
                <strong>Where:</strong>
              </div>
              <div className="ml-4 mb-4 flex items-center">
                HLC3ᵢ =
                <div className="mx-2 text-center">
                  <div className="border-b border-gray-700">Highᵢ + Lowᵢ + Closeᵢ</div>
                  <div>3</div>
                </div>
              </div>

              <div className="mb-2">
                <strong>Dynamic Volume Sizing:</strong>
              </div>
              <div className="mb-2 flex items-center">
                Price Deviation =
                <div className="mx-2 text-center">
                  <div className="border-b border-gray-700">VWAP - Current Price</div>
                  <div>VWAP</div>
                </div>
              </div>
              <div className="mb-2">Volume Multiplier = 1 + α × Price Deviation</div>
              <div className="mb-4">
                Adjusted Size = Base Size × clamp(Volume Multiplier, min_mult, max_mult)
              </div>

              <div className="mb-2">
                <strong>Parameters:</strong>
              </div>
              <div className="ml-4">
                <div>α (alpha): Sensitivity factor ∈ [0.1, 1.0]</div>
                <div>min_mult: Minimum volume multiplier (default: 0.1)</div>
                <div>max_mult: Maximum volume multiplier (default: 5.0)</div>
              </div>
            </div>

            <p className="text-gray-700">
              <strong>Innovation:</strong> When the current price is below VWAP (favorable
              conditions), the algorithm increases order volume to take advantage of the
              opportunity. Conversely, when price is above VWAP (unfavorable conditions), it reduces
              volume to minimize market impact.
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Slippage Protection</h3>
            <p className="text-gray-700 mb-4">
              Our algorithm incorporates real-time orderbook analysis for slippage protection:
            </p>

            <div className="bg-gray-50 rounded p-4 font-mono text-sm mb-4">
              <div className="mb-2">
                <strong>Slippage Calculation:</strong>
              </div>
              <div className="mb-2 flex items-center">
                Estimated Fill Price =
                <div className="mx-2 text-center">
                  <div className="border-b border-gray-700">Σⱼ Order Level Priceⱼ × Quantityⱼ</div>
                  <div>Σⱼ Quantityⱼ</div>
                </div>
              </div>
              <div className="mb-2 flex items-center">
                Slippage % =
                <div className="mx-2 text-center">
                  <div className="border-b border-gray-700">
                    |Estimated Fill Price - Market Price|
                  </div>
                  <div>Market Price</div>
                </div>
                × 100
              </div>
              <div className="mb-4">Volume Constraint = min(Requested Size, Max Depth × 0.1)</div>

              <div className="mb-2">
                <strong>Asset Decimal Compliance:</strong>
              </div>
              <div className="flex items-center">
                Rounded Size =
                <div className="mx-2 text-center">
                  <div className="border-b border-gray-700">⌊Size × 10^asset_decimals⌋</div>
                  <div>10^asset_decimals</div>
                </div>
              </div>
            </div>

            <p className="text-gray-700">
              The algorithm fetches real-time orderbook data from Hyperliquid&apos;s API to ensure orders
              don&apos;t exceed available liquidity and stay within acceptable slippage thresholds.
            </p>
          </div>
        </section>

        {/* Implementation Details */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Implementation Architecture</h2>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Sources</h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <strong>Chart Data:</strong> Hyperliquid WebSocket + REST API
                </li>
                <li>
                  <strong>VWAP Calculation:</strong> HLC3 Session-based anchoring
                </li>
                <li>
                  <strong>Orderbook:</strong> Real-time depth analysis
                </li>
                <li>
                  <strong>Market Info:</strong> Asset metadata & decimal precision
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Execution Engine</h3>
              <ul className="space-y-2 text-gray-700">
                <li>
                  <strong>Order Sizing:</strong> VWAP-enhanced dynamic calculation
                </li>
                <li>
                  <strong>Risk Management:</strong> Multi-layer slippage protection
                </li>
                <li>
                  <strong>Compliance:</strong> Hyperliquid decimal requirements
                </li>
                <li>
                  <strong>Timing:</strong> Configurable interval-based execution
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-xl font-semibold text-blue-900 mb-4">🚀 Technical Innovation</h3>
            <p className="text-blue-800 mb-4">
              <strong>Serverless Architecture:</strong> We&apos;ve pioneered a completely client-side
              trading system that operates without traditional backend infrastructure:
            </p>
            <ul className="space-y-2 text-blue-800">
              <li>
                • <strong>No Backend Required:</strong> Direct API integration with Hyperliquid
              </li>
              <li>
                • <strong>Resource Efficient:</strong> Eliminates server costs and maintenance
              </li>
              <li>
                • <strong>Real-time Processing:</strong> WebSocket connections for live data
              </li>
              <li>
                • <strong>Secure Execution:</strong> Client-side wallet integration
              </li>
            </ul>
          </div>
        </section>

        {/* Current Status & Roadmap */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Current Status & Development Roadmap
          </h2>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-3">✅ Current Features</h3>
              <ul className="space-y-2 text-green-800 text-sm">
                <li>• SPOT Trading (Pioneer Implementation)</li>
                <li>• VWAP-Enhanced TWAP Algorithm</li>
                <li>• Slippage Protection by Orderbook Analysis</li>
                <li>• Instant Volume Calculation</li>
                <li>• HLC3 VWAP Calculation</li>
                <li>• Asset Decimal Compliance</li>
                <li>• Simulation & Backtesting</li>
                <li>• WebSocket Chart Integration</li>
              </ul>
            </div>

            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
              <h3 className="text-lg font-semibold text-yellow-900 mb-3">🔄 In Development</h3>
              <ul className="space-y-2 text-yellow-800 text-sm">
                <li>• PERP Trading Support</li>
                <li>• Pair Trading Strategies</li>
                <li>• Advanced Risk Management</li>
                <li>• Multi-timeframe VWAP</li>
                <li>• Multiple VWAP Input Sources</li>
                <li>• Multi-Wallet Connection & Random Rotation</li>
                <li>• Random Time Interval & Volume Offsets</li>
                <li>• Enhanced UI/UX</li>
                <li>• Performance Optimizations</li>
                <li>• Additional Market Connectors</li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">🎯 Future Plans</h3>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li>• Machine Learning Integration</li>
                <li>• Cross-Exchange Arbitrage</li>
                <li>• Portfolio Management Tools</li>
                <li>• Advanced Analytics Dashboard</li>
                <li>• Mobile Application</li>
                <li>• Community Features</li>
              </ul>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
            <h3 className="text-xl font-semibold text-amber-900 mb-4">⚠️ Current Limitations</h3>
            <p className="text-amber-800 mb-4">
              <strong>VWAP Input Source:</strong> Currently locked to HLC3 (High-Low-Close/3)
              calculation method to ensure compatibility with Hyperliquid&apos;s native VWAP
              implementation.
            </p>
            <p className="text-amber-800">
              <strong>Upcoming Enhancement:</strong> Implementation of configurable VWAP input
              sources (OHLC4, Close-only, Volume-weighted Close, etc.) is planned for future
              releases to provide more flexibility for different trading strategies.
            </p>
          </div>
        </section>

        {/* Trading Pairs & Markets */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Supported Markets</h2>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-green-700 mb-3">🟢 SPOT Trading (Live)</h3>
              <p className="text-gray-700 mb-4">
                Currently supporting a few SPOT pairs as pioneer available on Hyperliquid with full
                VWAP-Enhanced TWAP functionality:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="bg-gray-50 px-3 py-2 rounded">HYPE/USDC</div>
                <div className="bg-gray-50 px-3 py-2 rounded">PURR/USDC</div>
                <div className="bg-gray-50 px-3 py-2 rounded">ETH/USDC</div>
                <div className="bg-gray-50 px-3 py-2 rounded">+ All Hyperliquid SPOT pairs</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-yellow-700 mb-3">
                🟡 PERP Trading (Coming Soon)
              </h3>
              <p className="text-gray-700">
                Perpetual futures trading with enhanced leverage management and funding rate
                optimization.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-blue-700 mb-3">🔵 Pair Trading (Future)</h3>
              <p className="text-gray-700">
                Advanced relative value strategies with correlation-based execution timing.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-gray-200">
          <p className="text-gray-600">
            Built with innovation • Powered by mathematical precision • Executed on Hyperliquid
          </p>
        </footer>
      </div>
    </div>
  );
}
