import { ethers } from "ethers";
import * as hl from "@nktkas/hyperliquid";
import { ARBITRUM_SEPOLIA_TESTNET, ARBITRUM_ONE_MAINNET } from "../../common";

// Network configurations
const NETWORKS = {
    testnet: ARBITRUM_SEPOLIA_TESTNET,
    mainnet: ARBITRUM_ONE_MAINNET,
} as const;

// Types
interface NetworkConfig {
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

interface WalletSigner {
    getAddress: () => Promise<string>;
    signMessage: (message: string) => Promise<string>;
    signTypedData: (domain: any, types: any, value: any) => Promise<string>;
}

interface AgentWallet {
    address: `0x${string}`;
    privateKey: string;
    mnemonic?: string;
}

/**
 * @dev new wallet generate will be an agent wallet
 */
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
    const targetNetwork = useTestnet ? NETWORKS.testnet : NETWORKS.mainnet;
    const expectedChainId = BigInt(targetNetwork.chainId);

    if (network.chainId !== expectedChainId) {
        throw new Error(
            `Network mismatch: expected ${targetNetwork.chainName} (${expectedChainId}), got ${network.chainId}`,
        );
    }
};

const createWalletSigner = (signer: ethers.JsonRpcSigner): WalletSigner => ({
    getAddress: () => signer.getAddress(),
    signMessage: (message: string) => signer.signMessage(message),
    signTypedData: (domain: any, types: any, value: any) =>
        signer.signTypedData(domain, types, value),
});

const createHyperliquidTransport = (useTestnet: boolean): hl.HttpTransport => {
    return new hl.HttpTransport({
        isTestnet: useTestnet,
        timeout: 30000,
    });
};

const createExchangeClient = (
    agentWallet: ethers.Wallet,
    useTestnet: boolean,
): hl.ExchangeClient => {
    const transport = createHyperliquidTransport(useTestnet);
    const targetNetwork = useTestnet ? NETWORKS.testnet : NETWORKS.mainnet;

    return new hl.ExchangeClient({
        wallet: agentWallet,
        transport,
        isTestnet: useTestnet,
        signatureChainId: targetNetwork.chainId,
    });
};

// Main agent authorization function
export async function authorizeAgent(
    useTestnet: boolean = true,
    agentName: string = "Nami",
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

    const ethersAgentWallet = new ethers.Wallet(agentWallet.privateKey);
    const client = createExchangeClient(ethersAgentWallet, useTestnet);

    try {
        await client.approveAgent({
            agentAddress: agentWallet.address,
            agentName,
        });

        return {
            agentWallet,
            userAddress,
            exchangeClient: client,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Agent approval failed: ${errorMessage}`);
    }
}

/////////////////////////////////////////////////////////////////////////////////////
////////////////////////// UTILITY MIGHT NEED IN FUTURE /////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////

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

export function createAgentExchangeClient(
    agentWallet: AgentWallet,
    useTestnet: boolean = true,
): hl.ExchangeClient {
    const ethersWallet = new ethers.Wallet(agentWallet.privateKey);
    return createExchangeClient(ethersWallet, useTestnet);
}

export function getNetworkConfig(useTestnet: boolean): NetworkConfig {
    return useTestnet ? NETWORKS.testnet : NETWORKS.mainnet;
}
