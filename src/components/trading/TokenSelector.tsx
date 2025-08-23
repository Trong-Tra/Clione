"use client";

import { useState, useEffect } from "react";

interface Token {
  symbol: string;
  name: string;
  price?: number;
  change24h?: number;
}

interface TokenSelectorProps {
  selectedToken: string;
  onTokenChange: (token: string) => void;
  network?: "mainnet" | "testnet";
}

// Component for handling token images from Hyperliquid
interface TokenImageProps {
  symbol: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function TokenImage({ symbol, size = "md", className = "" }: TokenImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const imageUrl = `https://app.hyperliquid.xyz/coins/${symbol}.svg`;

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  // Reset state when symbol changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [symbol]);

  if (imageError) {
    // Fallback to a generic token icon
    return (
      <div
        className={`${sizeClasses[size]} ${className} bg-gray-600 rounded-full flex items-center justify-center`}
      >
        <span className="text-white text-xs font-bold">{symbol.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {!imageLoaded && (
        <div className={`${sizeClasses[size]} bg-gray-600 rounded-full animate-pulse`} />
      )}
      <img
        src={imageUrl}
        alt={`${symbol} logo`}
        className={`${sizeClasses[size]} rounded-full transition-opacity ${
          imageLoaded ? "opacity-100" : "opacity-0"
        } ${imageLoaded ? "" : "absolute inset-0"}`}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  );
}

// Supported tokens by network
const MAINNET_TOKENS: Token[] = [
  { symbol: "HYPE", name: "Hyperliquid" },
  { symbol: "PURR", name: "Purr" },
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "FARTCOIN", name: "Fartcoin" },
  { symbol: "PENGU", name: "Pudgy Penguins" },
];

const TESTNET_TOKENS: Token[] = [
  { symbol: "HYPE", name: "Hyperliquid" },
  { symbol: "PURR", name: "Purr" },
  { symbol: "ETH", name: "Ethereum" },
];

export default function TokenSelector({
  selectedToken,
  onTokenChange,
  network = "mainnet",
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Get tokens based on network
  const availableTokens = network === "testnet" ? TESTNET_TOKENS : MAINNET_TOKENS;
  const [filteredTokens, setFilteredTokens] = useState<Token[]>(availableTokens);

  useEffect(() => {
    const filtered = availableTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTokens(filtered);
  }, [searchTerm, availableTokens]);

  const handleTokenSelect = (token: string) => {
    onTokenChange(token);
    setIsOpen(false);
    setSearchTerm("");
  };

  const selectedTokenInfo = availableTokens.find((t) => t.symbol === selectedToken);

  return (
    <div className="relative">
      {/* Token Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TokenImage symbol={selectedToken} size="md" />
            <div>
              <div className="text-white font-medium">{selectedToken}</div>
              {selectedTokenInfo && (
                <div className="text-xs text-gray-400">{selectedTokenInfo.name}</div>
              )}
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 max-h-96 flex flex-col">
          {/* Network indicator */}
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-600 bg-gray-750">
            {network === "testnet" ? "🧪 Testnet tokens" : "🌐 Mainnet tokens"}
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-gray-600">
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Token List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTokens.length > 0 ? (
              <div className="p-1">
                {filteredTokens.map((token) => (
                  <button
                    key={token.symbol}
                    type="button"
                    onClick={() => handleTokenSelect(token.symbol)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedToken === token.symbol
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-700 text-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <TokenImage symbol={token.symbol} size="sm" />
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-gray-400">{token.name}</div>
                        </div>
                      </div>
                      {token.price && (
                        <div className="text-right">
                          <div className="text-sm">${token.price.toFixed(2)}</div>
                          {token.change24h && (
                            <div
                              className={`text-xs ${
                                token.change24h >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {token.change24h >= 0 ? "+" : ""}
                              {token.change24h.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-400 text-sm">
                No tokens found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
