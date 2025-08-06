"use client";
import { useState } from "react";

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [token, setToken] = useState("");
  const [orderSize, setOrderSize] = useState("");

  const handleConnectWallet = () => {
    // Placeholder for wallet connection logic
    setWalletConnected(true);
  };

  const handlePlaceOrder = () => {
    // Placeholder for place order logic
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
          {walletConnected ? "Wallet Connected" : "Connect Wallet"}
        </button>
        <button
          className="bg-green-600 text-white px-6 py-2 rounded font-semibold"
          onClick={handlePlaceOrder}
          disabled={!walletConnected || !token || !orderSize}
        >
          Place Order
        </button>
      </div>
      <div className="text-gray-500 text-sm">
        * Market order only. Please connect your wallet and enter token & size.
      </div>
    </div>
  );
}
