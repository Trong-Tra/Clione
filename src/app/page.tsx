"use client";

import { useState } from "react";
import { authorizeAgent, placeOrder, type AgentWallet, type TWAPOrderParams } from "@/core";

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);
  const [asset, setAsset] = useState("155"); // Default asset ID
  const [isBuy, setIsBuy] = useState(true);
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnectWallet = async () => {
    setError("");
    setLoading(true);

    try {
      if (typeof window === "undefined" || !window.ethereum) {
        setError("MetaMask not detected. Please install MetaMask.");
        return;
      }

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x66eee" }], // Arbitrum Sepolia
        });
      } catch (switchError: any) {
        // If the network isn't added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x66eee",
                chainName: "Arbitrum Sepolia Testnet",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
                blockExplorerUrls: ["https://sepolia.arbiscan.io/"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length === 0) {
        setError("No accounts found in MetaMask.");
        return;
      }

      setWalletAddress(accounts[0]);
      setWalletConnected(true);
      setSuccess("Wallet connected successfully to Arbitrum Sepolia!");
    } catch (err: any) {
      setError("Failed to connect wallet: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeAgent = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    if (!walletConnected) {
      setError("Please connect your wallet first.");
      setLoading(false);
      return;
    }

    try {
      const result = await authorizeAgent(true, "Nami"); // useTestnet = true
      setAgentWallet(result.agentWallet);
      setSuccess(`Agent authorized! Address: ${result.agentWallet.address}`);
    } catch (err: any) {
      setError("Failed to authorize agent: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    if (!agentWallet) {
      setError("Please authorize agent first.");
      setLoading(false);
      return;
    }

    if (!price || !size) {
      setError("Please enter both price and size.");
      setLoading(false);
      return;
    }

    try {
      const orderParams: TWAPOrderParams = {
        asset: parseInt(asset),
        isBuy,
        price,
        size,
        timeInForce: "Gtc",
      };

      const result = await placeOrder(
        agentWallet.privateKey,
        orderParams,
        true // useTestnet
      );

      if (result.success) {
        setSuccess(`Order placed successfully! Order ID: ${result.orderId}`);
        // Clear form
        setPrice("");
        setSize("");
      } else {
        setError(result.error || "Failed to place order");
      }
    } catch (err: any) {
      setError("Failed to place order: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">
        Hyperliquid Trading Interface
      </h1>

      {/* Connection Status */}
      <div className="mb-6 text-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Wallet:{" "}
          {walletConnected
            ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
            : "Not connected"}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Agent:{" "}
          {agentWallet
            ? `${agentWallet.address.slice(0, 6)}...${agentWallet.address.slice(-4)}`
            : "Not authorized"}
        </div>
      </div>

      {/* Order Form */}
      <div className="flex flex-col gap-4 w-full max-w-md mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Place Order</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Asset ID
          </label>
          <input
            className="w-full border rounded px-3 py-2 text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            type="number"
            placeholder="155"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Order Type
          </label>
          <div className="flex gap-2">
            <button
              className={`flex-1 py-2 px-4 rounded ${
                isBuy
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
              }`}
              onClick={() => setIsBuy(true)}
            >
              Buy
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded ${
                !isBuy
                  ? "bg-red-600 text-white"
                  : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
              }`}
              onClick={() => setIsBuy(false)}
            >
              Sell
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Price
          </label>
          <input
            className="w-full border rounded px-3 py-2 text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            type="number"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            step="0.01"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Size
          </label>
          <input
            className="w-full border rounded px-3 py-2 text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
            type="number"
            placeholder="0.00"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            step="0.01"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        <button
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded font-semibold transition-colors"
          onClick={handleConnectWallet}
          disabled={walletConnected || loading}
        >
          {loading && !walletConnected
            ? "Connecting..."
            : walletConnected
            ? "Wallet Connected"
            : "Connect Wallet"}
        </button>

        <button
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded font-semibold transition-colors"
          onClick={handleAuthorizeAgent}
          disabled={!walletConnected || agentWallet !== null || loading}
        >
          {loading && !agentWallet
            ? "Authorizing..."
            : agentWallet
            ? "Agent Authorized"
            : "Authorize Trading Agent"}
        </button>

        <button
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded font-semibold transition-colors"
          onClick={handlePlaceOrder}
          disabled={!agentWallet || !price || !size || loading}
        >
          {loading && agentWallet ? "Placing Order..." : "Place Order"}
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded max-w-md w-full">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded max-w-md w-full">
          <strong>Success:</strong> {success}
        </div>
      )}

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Connected to Arbitrum Sepolia Testnet</p>
        <p>Make sure your wallet is on the correct network</p>
      </div>
    </div>
  );
}
