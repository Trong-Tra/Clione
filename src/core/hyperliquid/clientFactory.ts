import { ethers } from "ethers";
import * as hl from "@nktkas/hyperliquid";

// Network configurations
const ARBITRUM_ONE_MAINNET = {
  chainId: "0xa4b1",
  chainName: "Arbitrum One",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://arbitrum-one-rpc.publicnode.com"],
  blockExplorerUrls: ["https://arbiscan.io"],
} as const;

const ARBITRUM_SEPOLIA_TESTNET = {
  chainId: "0x66eee",
  chainName: "Arbitrum Sepolia Testnet", 
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
  blockExplorerUrls: ["https://sepolia.arbiscan.io/"],
} as const;

const NETWORKS = {
  testnet: ARBITRUM_SEPOLIA_TESTNET,
  mainnet: ARBITRUM_ONE_MAINNET,
} as const;

// Types
export interface HyperliquidClients {
  exchange: hl.ExchangeClient;
  info: hl.InfoClient;
  transport: hl.HttpTransport;
}

export interface ClientConfig {
  useTestnet?: boolean;
  timeout?: number;
}

export function createHyperliquidTransport(config: ClientConfig = {}): hl.HttpTransport {
  const { useTestnet = true, timeout = 30000 } = config;
  
  return new hl.HttpTransport({
    isTestnet: useTestnet,
    timeout,
  });
}

export function createExchangeClient(
  wallet: ethers.Wallet,
  config: ClientConfig = {}
): hl.ExchangeClient {
  const { useTestnet = true } = config;
  const transport = createHyperliquidTransport(config);
  const targetNetwork = useTestnet ? NETWORKS.testnet : NETWORKS.mainnet;

  return new hl.ExchangeClient({
    wallet,
    transport,
    isTestnet: useTestnet,
    signatureChainId: targetNetwork.chainId,
  });
}

// Exchange client factory for JsonRpcSigner (MetaMask)
export function createExchangeClientWithSigner(
  signer: ethers.JsonRpcSigner,
  config: ClientConfig = {}
): hl.ExchangeClient {
  const { useTestnet = true } = config;
  const transport = createHyperliquidTransport(config);
  const targetNetwork = useTestnet ? NETWORKS.testnet : NETWORKS.mainnet;

  // Create wallet interface compatible with Hyperliquid SDK
  const walletInterface = {
    getAddress: () => signer.getAddress(),
    signMessage: (message: string) => signer.signMessage(message),
    signTypedData: (domain: any, types: any, value: any) => 
      signer.signTypedData(domain, types, value),
  };

  return new hl.ExchangeClient({
    wallet: walletInterface as any,
    transport,
    isTestnet: useTestnet,
    signatureChainId: targetNetwork.chainId,
  });
}

export function createInfoClient(config: ClientConfig = {}): hl.InfoClient {
  const transport = createHyperliquidTransport(config);
  
  return new hl.InfoClient({
    transport,
  });
}

export function createHyperliquidClients(
  wallet: ethers.Wallet,
  config: ClientConfig = {}
): HyperliquidClients {
  const transport = createHyperliquidTransport(config);
  const { useTestnet = true } = config;
  const targetNetwork = useTestnet ? NETWORKS.testnet : NETWORKS.mainnet;

  const exchange = new hl.ExchangeClient({
    wallet,
    transport,
    isTestnet: useTestnet,
    signatureChainId: targetNetwork.chainId,
  });

  const info = new hl.InfoClient({
    transport,
  });

  return {
    exchange,
    info,
    transport,
  };
}

export function getNetworkConfig(useTestnet: boolean = true) {
  return useTestnet ? NETWORKS.testnet : NETWORKS.mainnet;
}

export type { hl };
