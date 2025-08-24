"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type NetworkMode = "mainnet" | "testnet";

interface NetworkContextType {
  isTestnet: () => boolean;
  setIsTestnet: (testnet: boolean) => void;
  getApiUrl: () => string;
  getWebSocketUrl: () => string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

interface NetworkProviderProps {
  children: ReactNode;
  defaultMode?: NetworkMode;
}

export function NetworkProvider({ children, defaultMode = "testnet" }: NetworkProviderProps) {
  const [networkMode, setNetworkMode] = useState<NetworkMode>(defaultMode);

  const getApiUrl = () => {
    return networkMode === "mainnet"
      ? "https://api.hyperliquid.xyz/info"
      : "https://api.hyperliquid-testnet.xyz/info";
  };

  const getWebSocketUrl = () => {
    return networkMode === "mainnet"
      ? "wss://api.hyperliquid.xyz/ws"
      : "wss://api.hyperliquid-testnet.xyz/ws";
  };

  const value: NetworkContextType = {
    isTestnet: () => networkMode === "testnet",
    setIsTestnet: (testnet: boolean) => setNetworkMode(testnet ? "testnet" : "mainnet"),
    getApiUrl,
    getWebSocketUrl,
  };

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}
