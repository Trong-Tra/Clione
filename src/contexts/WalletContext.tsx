/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";
import { authorizeAgent, AgentWallet } from "@/core/agent/agentAuth";
import { getNetworkConfig } from "@/core/hyperliquid/clientFactory";
import { useNetwork } from "./NetworkContext";

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  agentWallet: AgentWallet | null;
  isAgentAuthorized: boolean;
}

interface WalletContextType {
  walletState: WalletState;
  isConnecting: boolean;
  isAuthorizing: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  authorizeAgentWallet: () => Promise<void>;
  switchToTargetNetwork: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const { isTestnet } = useNetwork();

  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    isCorrectNetwork: false,
    agentWallet: null,
    isAgentAuthorized: false,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetNetwork = getNetworkConfig(isTestnet());
  const targetChainId = parseInt(targetNetwork.chainId);

  // Check if wallet is already connected
  useEffect(() => {
    checkWalletConnection();

    // Listen for account changes
    const ethereum = window.ethereum as any;
    if (ethereum && ethereum.on) {
      const handleAccounts = (accounts: string[]) => handleAccountsChanged(accounts);
      const handleChain = (chainId: string) => handleChainChanged(chainId);

      ethereum.on("accountsChanged", handleAccounts);
      ethereum.on("chainChanged", handleChain);

      return () => {
        if (ethereum.removeListener) {
          ethereum.removeListener("accountsChanged", handleAccounts);
          ethereum.removeListener("chainChanged", handleChain);
        }
      };
    }
  }, []);

  const checkWalletConnection = async () => {
    if (!window.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();

      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        const isCorrectNetwork = chainId === targetChainId;

        setWalletState((prev) => ({
          ...prev,
          isConnected: true,
          address,
          chainId,
          isCorrectNetwork,
        }));
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error);
    }
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      // Wallet disconnected
      setWalletState({
        isConnected: false,
        address: null,
        chainId: null,
        isCorrectNetwork: false,
        agentWallet: null,
        isAgentAuthorized: false,
      });
    } else {
      // Account changed
      await checkWalletConnection();
    }
  };

  const handleChainChanged = async (chainId: string) => {
    const newChainId = parseInt(chainId, 16);
    const isCorrectNetwork = newChainId === targetChainId;

    setWalletState((prev) => ({
      ...prev,
      chainId: newChainId,
      isCorrectNetwork,
      // Reset agent if network changed
      agentWallet: isCorrectNetwork ? prev.agentWallet : null,
      isAgentAuthorized: isCorrectNetwork ? prev.isAgentAuthorized : false,
    }));
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask or another Ethereum wallet");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);

      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const isCorrectNetwork = chainId === targetChainId;

      setWalletState((prev) => ({
        ...prev,
        isConnected: true,
        address,
        chainId,
        isCorrectNetwork,
      }));

      // If not on correct network, prompt user to switch
      if (!isCorrectNetwork) {
        await switchToTargetNetwork();
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError(error instanceof Error ? error.message : "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToTargetNetwork = async () => {
    if (!window.ethereum) return;

    try {
      // Try to switch to the target network
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      // If the network is not added, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: targetNetwork.chainName,
                nativeCurrency: targetNetwork.nativeCurrency,
                rpcUrls: targetNetwork.rpcUrls,
                blockExplorerUrls: targetNetwork.blockExplorerUrls,
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding network:", addError);
          setError("Failed to add network to wallet");
        }
      } else {
        console.error("Error switching network:", switchError);
        setError("Failed to switch to correct network");
      }
    }
  };

  const authorizeAgentWallet = async () => {
    if (!walletState.isConnected || !walletState.isCorrectNetwork) {
      setError("Please connect wallet and switch to correct network first");
      return;
    }

    setIsAuthorizing(true);
    setError(null);

    try {
      const result = await authorizeAgent(isTestnet(), "Nami Agent");

      setWalletState((prev) => ({
        ...prev,
        agentWallet: result.agentWallet,
        isAgentAuthorized: true,
      }));

      console.log("Agent authorized successfully:", result.agentWallet.address);
    } catch (error) {
      console.error("Error authorizing agent:", error);
      setError(error instanceof Error ? error.message : "Failed to authorize agent");
    } finally {
      setIsAuthorizing(false);
    }
  };

  const disconnectWallet = () => {
    setWalletState({
      isConnected: false,
      address: null,
      chainId: null,
      isCorrectNetwork: false,
      agentWallet: null,
      isAgentAuthorized: false,
    });
  };

  const clearError = () => {
    setError(null);
  };

  const value: WalletContextType = {
    walletState,
    isConnecting,
    isAuthorizing,
    error,
    connectWallet,
    disconnectWallet,
    authorizeAgentWallet,
    switchToTargetNetwork,
    clearError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
