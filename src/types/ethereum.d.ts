// Ethereum provider types for window.ethereum
export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isConnected?: () => boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
