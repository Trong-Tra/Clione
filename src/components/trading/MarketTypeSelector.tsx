"use client";

import { useState } from "react";

export type MarketType = "SPOT" | "PERP";

interface MarketTypeSelectorProps {
  selectedType: MarketType;
  onTypeChange: (type: MarketType) => void;
  className?: string;
}

export default function MarketTypeSelector({ 
  selectedType, 
  onTypeChange, 
  className = "" 
}: MarketTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const marketTypes: { value: MarketType; label: string; description: string; disabled?: boolean }[] = [
    { value: "PERP", label: "PERP", description: "Perpetual futures" },
    { value: "SPOT", label: "SPOT", description: "Spot trading" },
  ];

  const selectedMarketType = marketTypes.find(type => type.value === selectedType);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors text-sm"
      >
        <span className="text-white font-medium">{selectedMarketType?.label}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
            {marketTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => {
                  if (!type.disabled) {
                    onTypeChange(type.value);
                    setIsOpen(false);
                  }
                }}
                disabled={type.disabled}
                className={`w-full px-3 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  selectedType === type.value
                    ? "bg-blue-600 text-white"
                    : type.disabled 
                    ? "text-gray-500 cursor-not-allowed opacity-50"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                <div className="font-medium">{type.label}</div>
                <div className="text-xs text-gray-400">{type.description}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
