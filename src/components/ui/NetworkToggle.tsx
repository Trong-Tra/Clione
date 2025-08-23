"use client";

import { useNetwork } from "@/contexts/NetworkContext";

export default function NetworkToggle() {
  const { isTestnet, setIsTestnet } = useNetwork();
  const currentlyTestnet = isTestnet();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400">Network:</span>
      <div className="relative">
        <button
          onClick={() => setIsTestnet(!currentlyTestnet)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
            currentlyTestnet ? "bg-orange-500" : "bg-green-500"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
              currentlyTestnet ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span
            className={`text-xs font-medium ${
              currentlyTestnet ? "text-orange-400" : "text-green-400"
            }`}
          >
            {currentlyTestnet ? "Testnet" : "Mainnet"}
          </span>
        </div>
      </div>
    </div>
  );
}
