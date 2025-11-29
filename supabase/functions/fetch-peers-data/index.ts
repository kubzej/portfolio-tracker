// Supabase Edge Function for fetching peers comparison data
// Deploy with: supabase functions deploy fetch-peers-data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY') ?? '';

// Simplified peer data for comparison
interface PeerData {
  ticker: string;
  name: string | null;
  // Price
  currentPrice: number | null;
  priceChangePercent: number | null;
  // Valuation
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evEbitda: number | null;
  // Profitability
  roe: number | null;
  netMargin: number | null;
  // Growth
  revenueGrowth: number | null;
  epsGrowth: number | null;
  // Analyst
  recommendationKey: string | null;
  consensusScore: number | null;
  analystTargetPrice: number | null;
  targetUpside: number | null;
  // Size
  marketCap: number | null;
  // Historical returns
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  // Error
  error?: string;
}

interface PeersResult {
  mainStock: PeerData;
  peers: PeerData[];
  errors: string[];
  rateLimited?: {
    finnhub: boolean;
    yahoo: boolean;
  };
}

// Rate limit tracking
let rateLimitInfo = { finnhub: false, yahoo: false };

async function safeFetch(
  url: string,
  source: 'finnhub' | 'yahoo'
): Promise<Response> {
  const response = await fetch(url);
  if (response.status === 429) {
    rateLimitInfo[source] = true;
    console.warn(`Rate limited by ${source}: ${url}`);
  }
  return response;
}

async function fetchPeerData(ticker: string): Promise<PeerData> {
  const baseData: PeerData = {
    ticker,
    name: null,
    currentPrice: null,
    priceChangePercent: null,
    peRatio: null,
    pbRatio: null,
    psRatio: null,
    evEbitda: null,
    roe: null,
    netMargin: null,
    revenueGrowth: null,
    epsGrowth: null,
    recommendationKey: null,
    consensusScore: null,
    analystTargetPrice: null,
    targetUpside: null,
    marketCap: null,
    return1M: null,
    return3M: null,
    return6M: null,
    return1Y: null,
  };

  try {
    // Fetch data from Finnhub in parallel using safeFetch for rate limit detection
    const [quoteRes, metricsRes, recommendationRes, profileRes] =
      await Promise.all([
        safeFetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
            ticker
          )}&token=${FINNHUB_API_KEY}`,
          'finnhub'
        ),
        safeFetch(
          `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
            ticker
          )}&metric=all&token=${FINNHUB_API_KEY}`,
          'finnhub'
        ),
        safeFetch(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
            ticker
          )}&token=${FINNHUB_API_KEY}`,
          'finnhub'
        ),
        safeFetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(
            ticker
          )}&token=${FINNHUB_API_KEY}`,
          'finnhub'
        ),
      ]);

    const quote = quoteRes.ok ? await quoteRes.json() : null;
    const metricsData = metricsRes.ok ? await metricsRes.json() : null;
    const recommendations = recommendationRes.ok
      ? await recommendationRes.json()
      : null;
    const profile = profileRes.ok ? await profileRes.json() : null;

    // Parse quote
    const currentPrice = quote?.c ?? null;
    const priceChangePercent = quote?.dp ?? null;

    // Parse profile
    const name = profile?.name ?? null;

    // Parse metrics
    const metrics = metricsData?.metric ?? {};

    const peRatio = metrics.peBasicExclExtraTTM ?? metrics.peTTM ?? null;
    const pbRatio = metrics.pbQuarterly ?? metrics.pbAnnual ?? null;
    const psRatio = metrics.psTTM ?? null;
    const evEbitda = metrics.evEbitdaTTM ?? null;
    const roe = metrics.roeTTM ?? metrics.roeRfy ?? null;
    const netMargin =
      metrics.netProfitMarginTTM ?? metrics.netProfitMargin5Y ?? null;
    const revenueGrowth = metrics.revenueGrowthQuarterlyYoy ?? null;
    const epsGrowth = metrics.epsGrowthQuarterlyYoy ?? null;
    const marketCap = metrics.marketCapitalization ?? null;

    // Parse recommendations
    let recommendationKey = null;
    let consensusScore: number | null = null;

    const latestRec =
      Array.isArray(recommendations) && recommendations.length > 0
        ? recommendations[0]
        : null;

    if (latestRec) {
      const strongBuy = latestRec.strongBuy ?? 0;
      const buy = latestRec.buy ?? 0;
      const hold = latestRec.hold ?? 0;
      const sell = latestRec.sell ?? 0;
      const strongSell = latestRec.strongSell ?? 0;
      const total = strongBuy + buy + hold + sell + strongSell;

      if (total > 0) {
        consensusScore =
          (strongBuy * 2 + buy * 1 + hold * 0 + sell * -1 + strongSell * -2) /
          total;
        consensusScore = Math.round(consensusScore * 100) / 100;

        const buyTotal = strongBuy + buy;
        const sellTotal = sell + strongSell;
        if (buyTotal > sellTotal && buyTotal > hold) {
          recommendationKey = strongBuy > buy ? 'strong_buy' : 'buy';
        } else if (sellTotal > buyTotal && sellTotal > hold) {
          recommendationKey = strongSell > sell ? 'strong_sell' : 'sell';
        } else {
          recommendationKey = 'hold';
        }
      }
    }

    // Fetch analyst target from Yahoo
    let analystTargetPrice: number | null = null;
    try {
      const yahooRes = await safeFetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
          ticker
        )}?modules=financialData`,
        'yahoo'
      );
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const financialData =
          yahooData?.quoteSummary?.result?.[0]?.financialData;
        analystTargetPrice =
          financialData?.targetMeanPrice?.raw ??
          financialData?.targetMedianPrice?.raw ??
          null;
      }
    } catch {
      // Ignore Yahoo errors
    }

    // Calculate target upside
    let targetUpside: number | null = null;
    if (currentPrice && analystTargetPrice) {
      targetUpside = ((analystTargetPrice - currentPrice) / currentPrice) * 100;
      targetUpside = Math.round(targetUpside * 10) / 10;
    }

    // Fetch historical returns from Finnhub metrics
    const return1M = metrics['1MonthPriceReturnDaily'] ?? null;
    const return3M =
      metrics['3MonthPriceReturnDaily'] ??
      metrics['13WeekPriceReturnDaily'] ??
      null;
    const return6M =
      metrics['6MonthPriceReturnDaily'] ??
      metrics['26WeekPriceReturnDaily'] ??
      null;
    const return1Y =
      metrics['52WeekPriceReturnDaily'] ??
      metrics['yearToDatePriceReturnDaily'] ??
      null;

    return {
      ticker,
      name,
      currentPrice,
      priceChangePercent,
      peRatio,
      pbRatio,
      psRatio,
      evEbitda,
      roe,
      netMargin,
      revenueGrowth,
      epsGrowth,
      recommendationKey,
      consensusScore,
      analystTargetPrice,
      targetUpside,
      marketCap,
      return1M,
      return3M,
      return6M,
      return1Y,
    };
  } catch (error) {
    console.error(`Error fetching peer ${ticker}:`, error);
    return { ...baseData, error: String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Reset rate limit tracking for each request
  rateLimitInfo = { finnhub: false, yahoo: false };

  try {
    const { ticker, peers } = await req.json().catch(() => ({}));

    if (!ticker) {
      return new Response(JSON.stringify({ error: 'Ticker is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If peers not provided, fetch them from Finnhub
    let peersList: string[] = peers || [];

    if (!peers || peers.length === 0) {
      try {
        const peersRes = await safeFetch(
          `https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(
            ticker
          )}&token=${FINNHUB_API_KEY}`,
          'finnhub'
        );
        if (peersRes.ok) {
          const peersData = await peersRes.json();
          // Filter out self and limit to 5
          peersList = Array.isArray(peersData)
            ? peersData.filter((p: string) => p !== ticker).slice(0, 5)
            : [];
        }
      } catch {
        peersList = [];
      }
    }

    const errors: string[] = [];

    // Fetch main stock data first
    const mainStock = await fetchPeerData(ticker);
    if (mainStock.error) {
      errors.push(`${ticker}: ${mainStock.error}`);
    }

    // Fetch peers data with small delay between each to avoid rate limiting
    const peersData: PeerData[] = [];
    for (const peerTicker of peersList) {
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 150));

      const peerData = await fetchPeerData(peerTicker);
      if (peerData.error) {
        errors.push(`${peerTicker}: ${peerData.error}`);
      }
      peersData.push(peerData);
    }

    const result: PeersResult = {
      mainStock,
      peers: peersData,
      errors,
      rateLimited:
        rateLimitInfo.finnhub || rateLimitInfo.yahoo
          ? rateLimitInfo
          : undefined,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
