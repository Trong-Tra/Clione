"use client";

import Navigation from "@/components/Navigation";

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <Navigation />

      {/* Research Header */}
      <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Research & Analysis</h1>
              <p className="text-sm text-gray-300">Algorithm comparison and backtesting tools</p>
            </div>
          </div>

          <div className="text-sm text-gray-400">Coming Soon</div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-center">
          <div className="text-6xl mb-6">🚧</div>
          <h2 className="text-3xl font-bold text-white mb-4">Research Tools Coming Soon</h2>
          <p className="text-gray-400 mb-8 max-w-2xl">
            We're building advanced research and backtesting tools to help you analyze and compare
            different VWAP strategies. Features will include:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Historical Backtesting</h3>
              <p className="text-gray-400 text-sm">
                Test your VWAP strategies against historical market data to evaluate performance
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Strategy Comparison</h3>
              <p className="text-gray-400 text-sm">
                Compare different VWAP parameters and slippage protection settings side by side
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Performance Analytics</h3>
              <p className="text-gray-400 text-sm">
                Detailed metrics on execution quality, slippage, and market impact analysis
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Optimization Tools</h3>
              <p className="text-gray-400 text-sm">
                Auto-optimization of VWAP parameters based on market conditions and asset volatility
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-gray-500 text-sm">
              In the meantime, use the <strong>Simulation</strong> page to test your strategies
              risk-free!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
