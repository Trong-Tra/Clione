/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const network = searchParams.get('network') || 'mainnet';

  try {
    // Determine API URL based on network
    const apiUrl = network === 'mainnet' 
      ? 'https://api.hyperliquid.xyz/info'
      : 'https://api.hyperliquid-testnet.xyz/info';

    // Get spot metadata to see all available tokens
    const spotMetaResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'spotMeta' }),
    });

    if (!spotMetaResponse.ok) {
      throw new Error(`Failed to fetch spot metadata: ${spotMetaResponse.status}`);
    }

    const spotMeta = await spotMetaResponse.json();
    
    // Extract just the token names and their info for easier debugging
    const tokenInfo = spotMeta.tokens.map((token: any) => ({
      name: token.name,
      index: token.index,
      isCanonical: token.isCanonical,
      fullName: token.fullName
    }));

    // Extract universe info (spot pairs)
    const universeInfo = spotMeta.universe.map((pair: any) => ({
      name: pair.name,
      tokens: pair.tokens,
      index: pair.index,
      isCanonical: pair.isCanonical
    }));

    return NextResponse.json({
      success: true,
      network,
      tokenCount: tokenInfo.length,
      pairCount: universeInfo.length,
      tokens: tokenInfo,
      universe: universeInfo,
      // Look for BTC-like tokens specifically
      btcLikeTokens: tokenInfo.filter((token: any) => 
        token.name.toLowerCase().includes('btc') || 
        token.fullName?.toLowerCase().includes('bitcoin')
      ),
      // Look for ETH-like tokens specifically  
      ethLikeTokens: tokenInfo.filter((token: any) => 
        token.name.toLowerCase().includes('eth') || 
        token.fullName?.toLowerCase().includes('ethereum')
      )
    });

  } catch (error) {
    console.error('Error fetching spot metadata:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch spot metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
