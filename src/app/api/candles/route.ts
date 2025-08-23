import { NextRequest, NextResponse } from 'next/server';

// Supported tokens by network
const MAINNET_SUPPORTED_TOKENS = ['HYPE', 'PURR', 'BTC', 'ETH', 'FARTCOIN', 'PENGU'];
const TESTNET_SUPPORTED_TOKENS = ['HYPE', 'PURR', 'ETH'];

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const coin = searchParams.get('coin') || 'HYPE';
  const interval = searchParams.get('interval') || '15m';
  const count = parseInt(searchParams.get('count') || '100');
  const network = searchParams.get('network') || 'mainnet'; // Default to mainnet
  const marketType = searchParams.get('marketType') || 'PERP'; // Default to PERP

  // Validate token is supported on the network
  const supportedTokens = network === 'testnet' ? TESTNET_SUPPORTED_TOKENS : MAINNET_SUPPORTED_TOKENS;
  if (!supportedTokens.includes(coin)) {
    const networkTokens = supportedTokens.join(', ');
    return NextResponse.json(
      { 
        success: false, 
        error: `Token ${coin} is not supported on ${network}. Supported tokens: ${networkTokens}` 
      },
      { status: 400 }
    );
  }

  try {
    // Use the specified network for data fetching
    const now = Date.now();
    const intervalMs = getIntervalMs(interval);
    const startTime = now - count * intervalMs;

    // Determine API URL based on network
    const apiUrl = network === 'mainnet' 
      ? 'https://api.hyperliquid.xyz/info'
      : 'https://api.hyperliquid-testnet.xyz/info';

    // Handle different market types
    let apiCoin = coin;
    if (marketType === 'PERP') {
      // PERP markets use base symbol (BTC, ETH, HYPE, etc.)
      apiCoin = coin.replace('-PERP', ''); // Remove -PERP if present
    } else if (marketType === 'SPOT') {
      // SPOT markets require special handling - need to get spot metadata first
            const spotCoin = await getSpotCoinSymbol(coin, apiUrl, network);
      if (!spotCoin) {
        const networkNote = network === 'testnet' 
          ? `Note: ${coin} may not be available on testnet. Testnet has limited token support (BTC doesn't exist, ETH is SPOT-only).`
          : `Note: ${coin} SPOT trading may not be available on Hyperliquid ${network}. Try using PERP instead.`;
        
        return NextResponse.json(
          { 
            success: false, 
            error: `SPOT trading pair not found for ${coin}. This token may not be available as a SPOT pair on Hyperliquid. ${networkNote}` 
          },
          { status: 404 }
        );
      }
      apiCoin = spotCoin;
    }

    const payload = {
      type: 'candleSnapshot',
      req: {
        coin: apiCoin,
        interval,
        startTime,
        endTime: now,
      },
    };

    console.log(`📊 Fetching ${apiCoin} ${interval} ${marketType} candles (${count} candles) from ${network}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform to chart format
    const candles: Candle[] = data.map((candle: any) => ({
      time: Math.floor(candle.t / 1000), // Convert to seconds for TradingView format
      open: Number(candle.o),
      high: Number(candle.h),
      low: Number(candle.l),
      close: Number(candle.c),
      volume: Number(candle.v),
    }));

    // Sort by time
    candles.sort((a, b) => a.time - b.time);

    return NextResponse.json({
      success: true,
      data: candles,
      meta: {
        coin,
        interval,
        count: candles.length,
        latest: candles[candles.length - 1],
      }
    });

  } catch (error) {
    console.error('Error fetching candles:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTestnetLimitation = network === 'testnet' && (coin === 'BTC' || (coin === 'ETH' && marketType === 'PERP'));
    
    if (isTestnetLimitation) {
      const testnetNote = coin === 'BTC' 
        ? 'BTC is not available on testnet'
        : 'ETH PERP is not available on testnet (only SPOT is available)';
        
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to fetch ${coin} ${marketType} data from testnet: ${testnetNote}`,
          details: errorMessage
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch candle data',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

function getIntervalMs(interval: string): number {
  const intervals: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return intervals[interval] || intervals['15m'];
}

// Helper function to get the correct SPOT coin symbol
async function getSpotCoinSymbol(coin: string, apiUrl: string, network: string): Promise<string | null> {
  try {
    // First, get spot metadata to understand token mapping
    const spotMetaResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'spotMeta' }),
    });

    if (!spotMetaResponse.ok) {
      return null;
    }

    const spotMeta = await spotMetaResponse.json();
    
    // Network-specific token mappings with correct spot token names
    const getTokenMappings = (network: string): Record<string, string[]> => {
      if (network === 'mainnet') {
        return {
          'BTC': ['UBTC', 'BTC', 'WBTC'], // UBTC is the primary spot token on mainnet
          'ETH': ['UETH', 'ETH', 'WETH', 'stETH', 'weETH'], // UETH for mainnet
          'HYPE': ['UHYPE', 'HYPE'], // Try with U prefix first
          'PURR': ['UPURR', 'PURR'], // Try with U prefix first
          'PENGU': ['HPENGU', 'UPENGU', 'PENGU'], // Correct name is HPENGU
          'FARTCOIN': ['UFART', 'UFARTCOIN', 'FARTCOIN'], // Correct name is UFART
        };
      } else {
        // Testnet - ETH is UETH, others might be different
        return {
          'BTC': ['BTC'], // BTC doesn't exist on testnet
          'ETH': ['UETH', 'ETHER', 'ETH'], // Try UETH first, then ETHER on testnet
          'HYPE': ['HYPE', 'UHYPE'],
          'PURR': ['PURR', 'UPURR'],
        };
      }
    };

    const tokenMappings = getTokenMappings(network);

    // Get possible token names to check
    const possibleNames = tokenMappings[coin] || [`U${coin}`, coin]; // Try U prefix first as fallback
    
    // Try to find any of the possible token names
    let tokenInfo = null;
    let foundTokenName = null;
    for (const tokenName of possibleNames) {
      tokenInfo = spotMeta.tokens.find((token: any) => token.name === tokenName);
      if (tokenInfo) {
        foundTokenName = tokenName;
        break;
      }
    }

    if (!tokenInfo) {
      console.log(`❌ Could not find token info for ${coin}. Tried: ${possibleNames.join(', ')}`);
      return null;
    }

    // Find the corresponding spot pair in universe
    const spotPair = spotMeta.universe.find((pair: any) => 
      pair.tokens.includes(tokenInfo.index) && pair.tokens.includes(0) // 0 is USDC
    );

    if (!spotPair) {
      console.log(`❌ Could not find USDC spot pair for ${foundTokenName}`);
      return null;
    }

    console.log(`✅ Found spot pair for ${coin}: ${spotPair.name} (token: ${foundTokenName})`);
    // Use the pair's name (either canonical name or @index format)
    return spotPair.name;
  } catch (error) {
    console.error('Error getting spot coin symbol:', error);
    return null;
  }
}
