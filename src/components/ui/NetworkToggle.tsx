"use client";

import { useNetwork } from "@/contexts/NetworkContext";

export default function NetworkToggle() {
  const { isTestnet, setIsTestnet } = useNetwork();
  const currentlyTestnet = isTestnet();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Network:</span>
      <button
        onClick={() => setIsTestnet(!currentlyTestnet)}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          currentlyTestnet
            ? "bg-orange-100 text-orange-800 border border-orange-200"
            : "bg-green-100 text-green-800 border border-green-200"
        }`}
      >
        {currentlyTestnet ? "Testnet" : "Mainnet"}
      </button>
    </div>
  );
}
