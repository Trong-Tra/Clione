declare global {
  interface EthereumProvider {
    request: (args: {
      method: string;
      params?: unknown[];
    }) => Promise<string[]>;
  }
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// TypeScript declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}