// Ethereum provider types for window.ethereum
export interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
  isConnected?: () => boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
