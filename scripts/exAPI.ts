import { Hyperliquid } from "hyperliquid";
import "dotenv/config";

const sdk = new Hyperliquid({
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
    testnet: true,
    enableWs: false,
});

(async () => {
    await sdk.refreshAssetMapsNow();
})();

function checkOrderStatus(result: any) {
    const statuses = result?.response?.data?.statuses;
    if (Array.isArray(statuses)) {
        const errorStatuses = statuses.filter((s: any) => s?.error);
        if (errorStatuses.length > 0) {
            throw new Error(`Order failed: ${errorStatuses.map((s) => s.error).join("; ")}`);
        }
    } else {
        throw new Error("Invalid response format from SDK");
    }
}

export async function buyPURR() {
    const token = "PURR-SPOT";
    let orderBook;
    try {
        orderBook = await sdk.info.getL2Book(token);
        console.log("Order book fetched successfully:", orderBook);
    } catch (error) {
        console.error("Error fetching order book:", error);
        throw error;
    }

    const bids = orderBook.levels[0];
    const asks = orderBook.levels[1];

    if (!asks || asks.length === 0 || !bids || bids.length === 0) {
        throw new Error("No ask or bid prices available in the order book");
    }

    const bestAskPrice: number = Number(asks[0].px);
    const metaData = await sdk.info.spot.getSpotMeta();
    const tokenMeta = metaData.tokens.find((t) => t.name === token);
    if (!tokenMeta) {
        throw new Error(`Token metadata not found for ${token}`);
    }
    const tickSize = tokenMeta.szDecimals;
    console.log("Token metadata:", tokenMeta);
    console.log("Tick size:", tickSize);
    const marketPrice = Math.ceil(bestAskPrice).toString();

    console.log("Best ask price:", bestAskPrice);
    console.log("Market price for order:", marketPrice);

    const result = await sdk.exchange.placeOrder({
        coin: token,
        is_buy: true,
        sz: 2,
        limit_px: marketPrice,
        order_type: { limit: { tif: "Gtc" } },
        reduce_only: false,
    });

    console.log("Order placed successfully:", result);

    if (typeof result === "object" && result !== null) {
        if (result.response?.data?.statuses) {
            console.log("Statuses array:");
            result.response.data.statuses.forEach((status: any, index: number) => {
                console.log(`Status ${index + 1}:`, status);
            });
        }
    } else {
        console.log("Unexpected result type:", result);
    }
    checkOrderStatus(result);

    console.log("Order status checked successfully:", result);
}

async function main() {
    try {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await buyPURR();
    } catch (error) {
        console.error("Error in main function:", error); // sdk failure it does not work, error still result in status "ok"
    }
}

main();
