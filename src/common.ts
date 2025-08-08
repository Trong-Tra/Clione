export const ARBITRUM_ONE_MAINNET = {
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

export const ARBITRUM_SEPOLIA_TESTNET = {
    chainId: "0x66eee",
    chainName: "Arbitrum Sepolia Testnet",
    nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "ETH",
        decimal: 18,
    },
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    blockExplorerUrls: ["https://sepolia.arbiscan.io/"],
} as const;
