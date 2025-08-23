"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";

export default function NavWallet() {
  const {
    walletState,
    isConnecting,
    isAuthorizing,
    error,
    connectWallet,
    disconnectWallet,
    authorizeAgentWallet,
    switchToTargetNetwork,
    clearError,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getStatusColor = () => {
    if (!walletState.isConnected) return "bg-gray-600";
    if (!walletState.isCorrectNetwork) return "bg-red-500";
    if (walletState.isAgentAuthorized) return "bg-green-500";
    return "bg-yellow-500";
  };

  const getStatusText = () => {
    if (!walletState.isConnected) return "Not Connected";
    if (!walletState.isCorrectNetwork) return "Wrong Network";
    if (walletState.isAgentAuthorized) return "Agent Authorized";
    return "Connected";
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".wallet-dropdown")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Clear error after a timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="relative wallet-dropdown">
      {/* Wallet Button */}
      <button
        onClick={() => (walletState.isConnected ? setShowDropdown(!showDropdown) : connectWallet())}
        disabled={isConnecting}
        className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors text-sm border border-gray-600"
      >
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
        <span>
          {isConnecting
            ? "Connecting..."
            : walletState.isConnected
            ? formatAddress(walletState.address!)
            : "Connect Wallet"}
        </span>
        {walletState.isConnected && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && walletState.isConnected && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-lg border border-gray-600 z-50">
          <div className="p-4 space-y-4">
            {/* Wallet Info */}
            <div>
              <p className="text-sm text-gray-400">Wallet Address</p>
              <p className="text-white font-mono text-sm">{walletState.address}</p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Status</p>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
                  <span className="text-sm text-white">{getStatusText()}</span>
                </div>
              </div>
              {!walletState.isCorrectNetwork && (
                <button
                  onClick={switchToTargetNetwork}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-2 py-1 rounded"
                >
                  Switch Network
                </button>
              )}
            </div>

            {/* Network Info */}
            <div>
              <p className="text-sm text-gray-400">Network</p>
              <p
                className={`text-sm ${
                  walletState.isCorrectNetwork ? "text-green-400" : "text-red-400"
                }`}
              >
                {walletState.isCorrectNetwork
                  ? "Arbitrum Sepolia"
                  : `Wrong Network (Chain ID: ${walletState.chainId})`}
              </p>
            </div>

            {/* Agent Status */}
            {walletState.isCorrectNetwork && (
              <div>
                <p className="text-sm text-gray-400">Trading Agent</p>
                {walletState.isAgentAuthorized ? (
                  <div>
                    <p className="text-green-400 font-mono text-sm">
                      ✅ {formatAddress(walletState.agentWallet!.address)}
                    </p>
                    <p className="text-xs text-gray-500">Authorized and ready</p>
                  </div>
                ) : (
                  <button
                    onClick={authorizeAgentWallet}
                    disabled={isAuthorizing}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm py-2 px-3 rounded transition-colors"
                  >
                    {isAuthorizing ? "Authorizing..." : "Authorize Agent"}
                  </button>
                )}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 rounded p-2">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {/* Disconnect */}
            <button
              onClick={disconnectWallet}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
