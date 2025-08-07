"use client";
import { useState } from "react";
import { ARBITRUM_NETWORK } from "../common";

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [token, setToken] = useState("");
  const [orderSize, setOrderSize] = useState("");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");

  const handleConnectWallet = async () => {
    setError("");
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
      } else {
        setError("No accounts found in MetaMask.");
        return;
      }
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [ARBITRUM_NETWORK],
      });
    } catch {
      setError("Failed to connect or switch network.");
    }
  };

  const handleAuthorizeAgent = async () => {
    setError("");
    setSignature("");
    if (!walletConnected || !walletAddress) {
      setError("Please connect your wallet first.");
      return;
    }

    try {
      const domain = {
        name: "Hyperliquid",
        version: "1",
        chainId: ARBITRUM_NETWORK.chainId,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      };

      const types = {
        AgentAuthorization: [
          { name: "user", type: "address" },
          { name: "apiAgent", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      };

      const value = {
        user: walletAddress,
        apiAgent: "0xbC6Ae8e9D3852b712712a9F629Fe7ae7626DbA2B", // raw temp agent address
        /**
         * TODO: create a address generator to keep the private key for the session
         */
        nonce: 1,
        expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      };

      const signature = await window.ethereum.request({
        method: "eth_signTypedData_v4",
        params: [
          walletAddress,
          JSON.stringify({
            domain,
            types,
            primaryType: "AgentAuthorization",
            message: value,
          }),
        ],
      });

      setSignature(signature);
      alert("Agent authorized with signature. Signature:\n" + signature);
    } catch (err) {
      console.error(err);
      setError("Failed to get signature: " + (err.message || err));
    }
  };

  // Your existing placeholder handlePlaceOrder
  const handlePlaceOrder = () => {
    alert(`Order placed!\nToken: ${token}\nSize: ${orderSize}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
      <h1 className="text-2xl font-bold mb-8">Simple Market Order UI</h1>
      <div className="flex flex-col gap-4 w-full max-w-xs mb-8">
        <input
          className="border rounded px-3 py-2 text-base"
          type="text"
          placeholder="Token (e.g. ETH)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 text-base"
          type="number"
          placeholder="Order Size"
          value={orderSize}
          onChange={(e) => setOrderSize(e.target.value)}
        />
      </div>
      <div className="flex gap-4 mb-8">
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded font-semibold disabled:bg-gray-400"
          onClick={handleConnectWallet}
          disabled={walletConnected}
        >
          {walletConnected
            ? `Wallet Connected${
                walletAddress
                  ? `: ${walletAddress.slice(0, 6)}...${walletAddress.slice(
                      -4
                    )}`
                  : ""
              }`
            : "Connect Wallet (Arbitrum One)"}
        </button>
        <button
          className="bg-purple-600 text-white px-6 py-2 rounded font-semibold"
          onClick={handleAuthorizeAgent}
          disabled={!walletConnected}
        >
          Authorize API Agent Wallet
        </button>
        <button
          className="bg-green-600 text-white px-6 py-2 rounded font-semibold"
          onClick={handlePlaceOrder}
          disabled={!walletConnected || !token || !orderSize}
        >
          Place Order
        </button>
      </div>
      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
      {signature && (
        <div className="text-green-600 text-xs mb-2 break-all">
          Signature:
          <br />
          {signature}
        </div>
      )}
      <div className="text-gray-500 text-sm">
        * Market order only. Please connect your wallet (Arbitrum One) and enter
        token & size.
      </div>
    </div>
  );
}
