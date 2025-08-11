import { ethers } from "ethers";
import * as hl from "@nktkas/hyperliquid";
import { createExchangeClient, createExchangeClientWithSigner, getNetworkConfig } from "../hyperliquid/clientFactory";

// Types
export interface NetworkConfig {
  readonly chainId: string;
  readonly chainName: string;
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals?: number;
    readonly decimal?: number;
  };
  readonly rpcUrls: readonly string[];
  readonly blockExplorerUrls: readonly string[];
}

export interface WalletSigner {
  getAddress: () => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  signTypedData: (domain: any, types: any, value: any) => Promise<string>;
}

export interface AgentWallet {
  address: `0x${string}`;
  privateKey: string;
  mnemonic?: string;
}

// Core utilities
const generateRandomWallet = (): AgentWallet => {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address as `0x${string}`,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase,
  };
};

const validateWalletAddresses = (userAddress: string, agentAddress: string): void => {
  if (userAddress === agentAddress) {
    throw new Error("Agent wallet cannot be the same as the user wallet");
  }
};

const validateNetworkChainId = (network: { chainId: bigint }, useTestnet: boolean): void => {
  const targetNetwork = getNetworkConfig(useTestnet);
  const expectedChainId = BigInt(targetNetwork.chainId);
  
  if (network.chainId !== expectedChainId) {
    throw new Error(
      `Network mismatch: expected ${targetNetwork.chainName} (${expectedChainId}), got ${network.chainId}`
    );
  }
};

const createWalletSigner = (signer: ethers.JsonRpcSigner): WalletSigner => ({
  getAddress: () => signer.getAddress(),
  signMessage: (message: string) => signer.signMessage(message),
  signTypedData: (domain: any, types: any, value: any) => 
    signer.signTypedData(domain, types, value),
});

// Main agent authorization function
export async function authorizeAgent(
  useTestnet: boolean = true,
  agentName: string = "TradingAgent"
): Promise<{
  agentWallet: AgentWallet;
  userAddress: string;
  exchangeClient: hl.ExchangeClient;
}> {
  if (!window.ethereum) {
    throw new Error("Ethereum provider not found. Please install MetaMask or similar wallet.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  validateNetworkChainId(network, useTestnet);

  const signer = await provider.getSigner();
  const walletSigner = createWalletSigner(signer);
  const userAddress = await walletSigner.getAddress();
  
  const agentWallet = generateRandomWallet();
  validateWalletAddresses(userAddress, agentWallet.address);

  // Create exchange client with the MAIN WALLET (user's MetaMask) for authorization
  const mainWalletClient = createExchangeClientWithSigner(signer, { useTestnet });

  try {
    // The main wallet authorizes the agent wallet
    const approvalResult = await mainWalletClient.approveAgent({
      agentAddress: agentWallet.address,
      agentName,
    });

    // Create a separate exchange client for the agent wallet for future trading
    const ethersAgentWallet = new ethers.Wallet(agentWallet.privateKey);
    const agentExchangeClient = createExchangeClient(ethersAgentWallet, { useTestnet });

    return {
      agentWallet,
      userAddress,
      exchangeClient: agentExchangeClient,
    };
  } catch (error) {
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Provide more specific error messages
    if (errorMessage.includes("mainnet and testnet")) {
      throw new Error(
        `Network configuration error: Make sure you're on Arbitrum Sepolia testnet and the configuration is set to testnet mode. Details: ${errorMessage}`
      );
    } else if (errorMessage.includes("User rejected")) {
      throw new Error("Transaction was rejected by user. Please try again and approve the transaction.");
    } else if (errorMessage.includes("insufficient funds")) {
      throw new Error("Insufficient funds in wallet. Please ensure you have enough ETH for gas fees.");
    } else if (errorMessage.includes("network")) {
      throw new Error(`Network error: Please check your connection and ensure you're on Arbitrum Sepolia testnet. Details: ${errorMessage}`);
    } else {
      throw new Error(`Agent approval failed: ${errorMessage}`);
    }
  }
}

// Utility function to create agent wallet from existing private key
export function createAgentWalletFromPrivateKey(privateKey: string): AgentWallet {
  try {
    const wallet = new ethers.Wallet(privateKey);
    return {
      address: wallet.address as `0x${string}`,
      privateKey: wallet.privateKey,
    };
  } catch (error) {
    throw new Error("Invalid private key provided");
  }
}

// Utility function to create exchange client with existing agent wallet
export function createAgentExchangeClient(
  agentWallet: AgentWallet,
  useTestnet: boolean = true
): hl.ExchangeClient {
  const ethersWallet = new ethers.Wallet(agentWallet.privateKey);
  return createExchangeClient(ethersWallet, { useTestnet });
}
