import * as hl from "@nktkas/hyperliquid";

async function getPurrAssetIds() {
  const infoClient = new hl.InfoClient({
    transport: new hl.HttpTransport({
      timeout: 30000,
      isTestnet: true,
    }),
  });

  try {
    const spotMeta = await infoClient.spotMeta();
    
    if (spotMeta && spotMeta.tokens) {
      // Find PURR token
      for (const [tokenId, tokenInfo] of Object.entries(spotMeta.tokens)) {
        if (tokenInfo.name === "PURR") {
          console.log("PURR Token ID:", tokenId);
          
          // Find the spot pair index for PURR
          if (spotMeta.universe) {
            for (let i = 0; i < spotMeta.universe.length; i++) {
              const spotInfo = spotMeta.universe[i];
              if (spotInfo.tokens && 
                  (spotInfo.tokens[0] === parseInt(tokenId) || spotInfo.tokens[1] === parseInt(tokenId))) {
                const spotAssetId = 10000 + i;
                console.log(`PURR Spot Asset ID (for ${spotInfo.name}):`, spotAssetId);
              }
            }
          }
          
          return {
            tokenId: parseInt(tokenId),
            // spotAssetId will be logged above
          };
        }
      }
    }

    console.log("PURR not found");
    return null;

  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

getPurrAssetIds();