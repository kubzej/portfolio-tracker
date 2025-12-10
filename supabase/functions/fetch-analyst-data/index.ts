// Supabase Edge Function for fetching analyst data from Finnhub + Yahoo Finance
// Deploy with: supabase functions deploy fetch-analyst-data
//
// Features:
// - Finnhub API cache to reduce rate limit issues (60 calls/min FREE tier)
// - Sequential API calls with delays between tickers
// - Retry logic with exponential backoff on 429 errors

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  createClient,
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY') ?? '';
const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY') ?? '';

// Rate limit tracking
let rateLimitInfo = { finnhub: false, yahoo: false, alpha: false };

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

type CacheDataType =
  | 'recommendation'
  | 'metrics'
  | 'earnings'
  | 'peers'
  | 'profile'
  | 'insider'
  | 'description';

// Cache TTL in hours
const CACHE_TTL_HOURS: Record<CacheDataType, number> = {
  recommendation: 24,
  metrics: 24,
  earnings: 24,
  insider: 24,
  peers: 30 * 24, // 30 days
  profile: 30 * 24, // 30 days
  description: 90 * 24, // 90 days - company descriptions rarely change
};

// Delay between API calls in ms (to avoid rate limiting)
const API_CALL_DELAY_MS = 150;
const TICKER_DELAY_MS = 300;

// Helper to delay execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// CACHE FUNCTIONS
// ============================================================================

async function getCachedData<T>(
  supabase: SupabaseClient,
  ticker: string,
  dataType: CacheDataType
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('finnhub_cache')
      .select('data, expires_at')
      .eq('ticker', ticker)
      .eq('data_type', dataType)
      .single();

    if (error || !data) return null;

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      console.log(`Cache expired for ${ticker}/${dataType}`);
      return null;
    }

    return data.data as T;
  } catch {
    return null;
  }
}

async function setCachedData(
  supabase: SupabaseClient,
  ticker: string,
  dataType: CacheDataType,
  data: unknown
): Promise<void> {
  // Don't cache null/empty data
  if (data === null || data === undefined) return;
  if (Array.isArray(data) && data.length === 0) return;
  if (typeof data === 'object' && Object.keys(data as object).length === 0)
    return;

  const ttlHours = CACHE_TTL_HOURS[dataType];
  const expiresAt = new Date(
    Date.now() + ttlHours * 60 * 60 * 1000
  ).toISOString();

  try {
    await supabase.from('finnhub_cache').upsert(
      {
        ticker,
        data_type: dataType,
        data,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      {
        onConflict: 'ticker,data_type',
      }
    );
    console.log(`Cache SET for ${ticker}/${dataType}, expires: ${expiresAt}`);
  } catch (err) {
    console.error(`Failed to cache ${ticker}/${dataType}:`, err);
  }
}

async function clearCacheForTicker(
  supabase: SupabaseClient,
  ticker: string
): Promise<void> {
  await supabase.from('finnhub_cache').delete().eq('ticker', ticker);
  console.log(`Cache cleared for ${ticker}`);
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

async function fetchWithRetry(
  url: string,
  source: 'finnhub' | 'yahoo',
  maxRetries = 3
): Promise<Response | null> {
  const headers: Record<string, string> = {};

  if (source === 'yahoo') {
    headers['User-Agent'] =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers });

      if (response.status === 429) {
        rateLimitInfo[source] = true;
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(
          `Rate limited by ${source}, attempt ${
            attempt + 1
          }/${maxRetries}, waiting ${waitTime}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (err) {
      console.error(`Fetch error for ${url}:`, err);
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  return null;
}

// Safe fetch with rate limit detection (backwards compatible)
async function safeFetch(
  url: string,
  source: 'finnhub' | 'yahoo'
): Promise<Response> {
  const result = await fetchWithRetry(url, source);
  if (!result) {
    // Return a fake 429 response if all retries failed
    return new Response(null, { status: 429 });
  }
  return result;
}

// Earnings surprise data
interface EarningsData {
  actual: number | null;
  estimate: number | null;
  period: string | null;
  surprise: number | null;
  surprisePercent: number | null;
}

// Fundamental metrics - all available from Finnhub FREE tier
interface FundamentalMetrics {
  // Valuation
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  pegRatio: number | null;
  evEbitda: number | null;
  forwardPe: number | null;
  // Profitability
  roe: number | null;
  roa: number | null;
  roi: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  // Growth
  revenueGrowth: number | null;
  epsGrowth: number | null;
  revenueGrowth3Y: number | null;
  revenueGrowth5Y: number | null;
  epsGrowth5Y: number | null;
  // Risk
  beta: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  // Dividend
  dividendYield: number | null;
  payoutRatio: number | null;
  dividendGrowth5Y: number | null;
  // Performance
  return52W: number | null;
  return13W: number | null;
  returnVsSP500: number | null;
  // Size
  marketCap: number | null;
  enterpriseValue: number | null;
}

// Insider sentiment monthly data point
interface InsiderMonthlyData {
  year: number;
  month: number;
  mspr: number;
  change: number;
}

// Insider sentiment data with all monthly points for client-side filtering
interface InsiderSentiment {
  mspr: number | null; // Monthly Share Purchase Ratio (-100 to 100) - aggregated
  change: number | null; // Net buying/selling - aggregated
  monthlyData: InsiderMonthlyData[]; // All monthly data for time range filtering
}

interface AnalystData {
  ticker: string;
  stockName: string;
  // Price data
  currentPrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  // Analyst recommendations
  recommendationKey: string | null;
  consensusScore: number | null; // -2 (strong sell) to +2 (strong buy)
  strongBuy: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  strongSell: number | null;
  numberOfAnalysts: number | null;
  recommendationPeriod: string | null; // When recommendations were last updated
  // Analyst target price (from Yahoo Finance)
  analystTargetPrice: number | null;
  // Earnings data (last 4 quarters)
  earnings: EarningsData[];
  // Fundamental metrics
  fundamentals: FundamentalMetrics;
  // Insider sentiment
  insiderSentiment: InsiderSentiment | null;
  // Company peers
  peers: string[];
  // Company profile
  industry: string | null;
  description: string | null;
  descriptionSource: 'alpha' | null; // Where description came from
  // Error tracking
  error?: string;
}

// Types for Finnhub API responses (used for caching)
interface FinnhubRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
}

interface FinnhubEarnings {
  actual: number | null;
  estimate: number | null;
  period: string;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
}

interface FinnhubInsiderData {
  year: number;
  month: number;
  mspr?: number;
  change?: number;
}

interface FinnhubMetrics {
  metric?: Record<string, number | null>;
}

interface FinnhubProfile {
  finnhubIndustry?: string;
}

interface FinnhubInsider {
  data?: FinnhubInsiderData[];
}

// Main function to fetch analyst data for a single ticker
// Now with caching support to avoid rate limiting
async function fetchAnalystData(
  ticker: string,
  stockName: string,
  finnhubTicker: string | undefined,
  supabase: SupabaseClient,
  forceRefresh: boolean = false
): Promise<AnalystData> {
  // Use provided finnhubTicker or default to ticker (for US stocks)
  const finnhubSymbol = finnhubTicker || ticker;

  const emptyFundamentals: FundamentalMetrics = {
    // Valuation
    peRatio: null,
    pbRatio: null,
    psRatio: null,
    pegRatio: null,
    evEbitda: null,
    forwardPe: null,
    // Profitability
    roe: null,
    roa: null,
    roi: null,
    grossMargin: null,
    operatingMargin: null,
    netMargin: null,
    // Growth
    revenueGrowth: null,
    epsGrowth: null,
    revenueGrowth3Y: null,
    revenueGrowth5Y: null,
    epsGrowth5Y: null,
    // Risk
    beta: null,
    debtToEquity: null,
    currentRatio: null,
    quickRatio: null,
    // Dividend
    dividendYield: null,
    payoutRatio: null,
    dividendGrowth5Y: null,
    // Performance
    return52W: null,
    return13W: null,
    returnVsSP500: null,
    // Size
    marketCap: null,
    enterpriseValue: null,
  };

  const baseData: AnalystData = {
    ticker,
    stockName,
    currentPrice: null,
    priceChange: null,
    priceChangePercent: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    recommendationKey: null,
    consensusScore: null,
    strongBuy: null,
    buy: null,
    hold: null,
    sell: null,
    strongSell: null,
    numberOfAnalysts: null,
    recommendationPeriod: null,
    analystTargetPrice: null,
    earnings: [],
    fundamentals: emptyFundamentals,
    insiderSentiment: null,
    peers: [],
    industry: null,
    description: null,
    descriptionSource: null,
  };

  try {
    // Initialize data holders
    let recommendations: FinnhubRecommendation[] | null = null;
    let quote: FinnhubQuote | null = null;
    let earningsData: FinnhubEarnings[] | null = null;
    let metricsData: FinnhubMetrics | null = null;
    let peersData: string[] | null = null;
    let profileData: FinnhubProfile | null = null;
    let insiderData: FinnhubInsider | null = null;

    // Track which endpoints we need to fetch from API
    // Default: need to fetch everything (will be set to false if cache hit)
    const needsFetch = {
      recommendation: true,
      quote: true, // Always fetch quote - it's real-time data
      earnings: true,
      metrics: true,
      peers: true,
      profile: true,
      insider: true,
    };

    // STEP 1: Check cache for non-real-time data (only if not forcing refresh)
    if (!forceRefresh) {
      const cachedRecommendation = await getCachedData<FinnhubRecommendation[]>(
        supabase,
        finnhubSymbol,
        'recommendation'
      );
      if (cachedRecommendation) {
        recommendations = cachedRecommendation;
        needsFetch.recommendation = false;
        console.log(`[CACHE HIT] ${ticker} recommendation`);
      }

      const cachedEarnings = await getCachedData<FinnhubEarnings[]>(
        supabase,
        finnhubSymbol,
        'earnings'
      );
      if (cachedEarnings) {
        earningsData = cachedEarnings;
        needsFetch.earnings = false;
        console.log(`[CACHE HIT] ${ticker} earnings`);
      }

      const cachedMetrics = await getCachedData<FinnhubMetrics>(
        supabase,
        finnhubSymbol,
        'metrics'
      );
      if (cachedMetrics) {
        metricsData = cachedMetrics;
        needsFetch.metrics = false;
        console.log(`[CACHE HIT] ${ticker} metrics`);
      }

      const cachedPeers = await getCachedData<string[]>(
        supabase,
        finnhubSymbol,
        'peers'
      );
      if (cachedPeers) {
        peersData = cachedPeers;
        needsFetch.peers = false;
        console.log(`[CACHE HIT] ${ticker} peers`);
      }

      const cachedProfile = await getCachedData<FinnhubProfile>(
        supabase,
        finnhubSymbol,
        'profile'
      );
      if (cachedProfile) {
        profileData = cachedProfile;
        needsFetch.profile = false;
        console.log(`[CACHE HIT] ${ticker} profile`);
      }

      const cachedInsider = await getCachedData<FinnhubInsider>(
        supabase,
        finnhubSymbol,
        'insider'
      );
      if (cachedInsider) {
        insiderData = cachedInsider;
        needsFetch.insider = false;
        console.log(`[CACHE HIT] ${ticker} insider`);
      }
    }

    // STEP 2: Fetch missing data from Finnhub SEQUENTIALLY with delays
    // This is critical for rate limiting - we can't use Promise.all anymore

    if (needsFetch.recommendation) {
      console.log(`[API] ${ticker} fetching recommendation...`);
      const res = await fetchWithRetry(
        `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      );
      if (res?.ok) {
        recommendations = await res.json();
        if (
          recommendations &&
          Array.isArray(recommendations) &&
          recommendations.length > 0
        ) {
          await setCachedData(
            supabase,
            finnhubSymbol,
            'recommendation',
            recommendations
          );
        }
      }
      await delay(API_CALL_DELAY_MS);
    }

    if (needsFetch.quote) {
      // Quote is always fresh - don't cache
      const res = await fetchWithRetry(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      );
      if (res?.ok) {
        quote = await res.json();
      }
      await delay(API_CALL_DELAY_MS);
    }

    if (needsFetch.earnings) {
      console.log(`[API] ${ticker} fetching earnings...`);
      const res = await fetchWithRetry(
        `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      );
      if (res?.ok) {
        earningsData = await res.json();
        if (
          earningsData &&
          Array.isArray(earningsData) &&
          earningsData.length > 0
        ) {
          await setCachedData(
            supabase,
            finnhubSymbol,
            'earnings',
            earningsData
          );
        }
      }
      await delay(API_CALL_DELAY_MS);
    }

    if (needsFetch.metrics) {
      console.log(`[API] ${ticker} fetching metrics...`);
      const res = await fetchWithRetry(
        `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&metric=all&token=${FINNHUB_API_KEY}`,
        'finnhub'
      );
      if (res?.ok) {
        metricsData = await res.json();
        if (metricsData?.metric && Object.keys(metricsData.metric).length > 0) {
          await setCachedData(supabase, finnhubSymbol, 'metrics', metricsData);
        }
      }
      await delay(API_CALL_DELAY_MS);
    }

    if (needsFetch.peers) {
      console.log(`[API] ${ticker} fetching peers...`);
      const res = await fetchWithRetry(
        `https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      );
      if (res?.ok) {
        peersData = await res.json();
        if (peersData && Array.isArray(peersData) && peersData.length > 0) {
          await setCachedData(supabase, finnhubSymbol, 'peers', peersData);
        }
      }
      await delay(API_CALL_DELAY_MS);
    }

    if (needsFetch.profile) {
      console.log(`[API] ${ticker} fetching profile...`);
      const res = await fetchWithRetry(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      );
      if (res?.ok) {
        profileData = await res.json();
        if (profileData && profileData.finnhubIndustry) {
          await setCachedData(supabase, finnhubSymbol, 'profile', profileData);
        }
      }
      await delay(API_CALL_DELAY_MS);
    }

    if (needsFetch.insider) {
      console.log(`[API] ${ticker} fetching insider...`);
      const res = await fetchWithRetry(
        `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&from=${getDateMonthsAgo(
          12
        )}&to=${getTodayDate()}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      );
      if (res?.ok) {
        insiderData = await res.json();
        if (
          insiderData?.data &&
          Array.isArray(insiderData.data) &&
          insiderData.data.length > 0
        ) {
          await setCachedData(supabase, finnhubSymbol, 'insider', insiderData);
        }
      }
      // No delay after last Finnhub call
    }

    // Rest of the function continues with data processing...

    // Check if this is a non-US stock (has exchange suffix like .DE, .L, etc.)
    // For non-US stocks, we ALWAYS use Yahoo for price (Finnhub might return ADR price in USD)
    const isNonUSStock = ticker.includes('.');

    let currentPrice: number | null = null;
    let priceChange: number | null = null;
    let priceChangePercent: number | null = null;
    let fiftyTwoWeekHigh: number | null = null;
    let fiftyTwoWeekLow: number | null = null;

    // For US stocks, try Finnhub quote first
    if (!isNonUSStock) {
      currentPrice = quote?.c ?? null;
      priceChange = quote?.d ?? null;
      priceChangePercent = quote?.dp ?? null;

      // Get 52-week high/low from metrics if available
      if (metricsData?.metric) {
        fiftyTwoWeekHigh = metricsData.metric['52WeekHigh'] ?? null;
        fiftyTwoWeekLow = metricsData.metric['52WeekLow'] ?? null;
      }
    }

    // For non-US stocks OR if Finnhub price is missing, use Yahoo
    if (isNonUSStock || currentPrice === null || currentPrice === 0) {
      try {
        // Use range=1d for accurate daily price/change data (matches Yahoo website)
        const yahooQuoteUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          ticker
        )}?interval=1d&range=1d`;
        const yahooQuoteRes = await safeFetch(yahooQuoteUrl, 'yahoo');

        if (yahooQuoteRes.ok) {
          const yahooData = await yahooQuoteRes.json();
          const result = yahooData?.chart?.result?.[0];

          if (result) {
            const meta = result.meta;
            currentPrice = meta.regularMarketPrice ?? null;
            // Use regularMarketPreviousClose for accurate daily change
            const previousClose =
              meta.regularMarketPreviousClose ??
              meta.previousClose ??
              meta.chartPreviousClose ??
              null;

            if (currentPrice !== null && previousClose !== null) {
              priceChange = currentPrice - previousClose;
              priceChangePercent = (priceChange / previousClose) * 100;
            }
          }
        }

        // Fetch 52-week data separately if needed
        if (fiftyTwoWeekHigh === null || fiftyTwoWeekLow === null) {
          const yahoo52wUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            ticker
          )}?interval=1d&range=1y`;
          const yahoo52wRes = await safeFetch(yahoo52wUrl, 'yahoo');

          if (yahoo52wRes.ok) {
            const yahooData = await yahoo52wRes.json();
            const result = yahooData?.chart?.result?.[0];

            if (result) {
              const quotes = result.indicators?.quote?.[0];
              if (quotes?.high && quotes?.low) {
                const highs = quotes.high.filter(
                  (h: number | null) => h !== null
                );
                const lows = quotes.low.filter(
                  (l: number | null) => l !== null
                );
                if (highs.length > 0) fiftyTwoWeekHigh = Math.max(...highs);
                if (lows.length > 0) fiftyTwoWeekLow = Math.min(...lows);
              }
            }
          }
        }
      } catch (yahooError) {
        console.error(`Yahoo fallback failed for ${ticker}:`, yahooError);
      }
    }

    // Fetch analyst target price from Yahoo Finance (FREE)
    let analystTargetPrice: number | null = null;
    try {
      const yahooSummaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        ticker
      )}?modules=financialData`;
      const yahooSummaryRes = await safeFetch(yahooSummaryUrl, 'yahoo');

      if (yahooSummaryRes.ok) {
        const summaryData = await yahooSummaryRes.json();
        const result = summaryData?.quoteSummary?.result?.[0];
        const financialData = result?.financialData;

        if (financialData) {
          // Use targetMeanPrice (average of all analyst targets)
          analystTargetPrice =
            financialData.targetMeanPrice?.raw ??
            financialData.targetMedianPrice?.raw ??
            null;
        }
      }
    } catch (targetError) {
      console.error(`Yahoo summary failed for ${ticker}:`, targetError);
    }

    // Fetch company description from Alpha Vantage (US stocks only)
    // Alpha Vantage has very low limits (25/day FREE), so we cache for 90 days
    let description: string | null = null;
    let descriptionSource: 'alpha' | null = null;

    // Check cache first for description
    if (!forceRefresh) {
      const cachedDescription = await getCachedData<string>(
        supabase,
        ticker,
        'description'
      );
      if (cachedDescription) {
        description = cachedDescription;
        descriptionSource = 'alpha';
        console.log(`[CACHE HIT] ${ticker} description`);
      }
    }

    // Only fetch from Alpha Vantage if not cached and API key is present
    if (!description && ALPHA_VANTAGE_API_KEY) {
      try {
        const alphaSymbol = yahooToAlphaVantageTicker(ticker);
        const alphaUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(
          alphaSymbol
        )}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        console.log(`[API] ${ticker} fetching Alpha Vantage description...`);
        const alphaRes = await fetch(alphaUrl);

        if (alphaRes.ok) {
          const alphaData = await alphaRes.json();
          if (
            alphaData?.Description &&
            !alphaData?.Note &&
            !alphaData?.Information
          ) {
            description = alphaData.Description;
            descriptionSource = 'alpha';
            // Cache the description for 90 days
            await setCachedData(supabase, ticker, 'description', description);
            console.log(`[CACHE SET] ${ticker} description`);
          } else if (alphaData?.Information) {
            console.log(`Alpha Vantage rate limited: ${alphaData.Information}`);
            rateLimitInfo.alpha = true;
          }
        } else {
          console.log(`Alpha Vantage failed: ${alphaRes.status}`);
        }
      } catch (alphaError) {
        console.error(`Alpha Vantage error for ${ticker}:`, alphaError);
      }
    }

    // Get latest recommendation (first item in array is most recent)
    const latestRec =
      Array.isArray(recommendations) && recommendations.length > 0
        ? recommendations[0]
        : null;

    let recommendationKey = null;
    let consensusScore: number | null = null;
    let strongBuy = null;
    let buy = null;
    let hold = null;
    let sell = null;
    let strongSell = null;
    let numberOfAnalysts = null;
    let recommendationPeriod: string | null = null;

    if (latestRec) {
      strongBuy = latestRec.strongBuy ?? null;
      buy = latestRec.buy ?? null;
      hold = latestRec.hold ?? null;
      sell = latestRec.sell ?? null;
      strongSell = latestRec.strongSell ?? null;
      recommendationPeriod = latestRec.period ?? null;

      // Calculate total analysts
      numberOfAnalysts =
        (strongBuy || 0) +
        (buy || 0) +
        (hold || 0) +
        (sell || 0) +
        (strongSell || 0);

      // Calculate consensus score: weighted average from -2 to +2
      // Strong Sell = -2, Sell = -1, Hold = 0, Buy = +1, Strong Buy = +2
      if (numberOfAnalysts > 0) {
        consensusScore =
          ((strongBuy || 0) * 2 +
            (buy || 0) * 1 +
            (hold || 0) * 0 +
            (sell || 0) * -1 +
            (strongSell || 0) * -2) /
          numberOfAnalysts;
        consensusScore = Math.round(consensusScore * 100) / 100; // Round to 2 decimals
      }

      // Determine recommendation key based on majority
      if (numberOfAnalysts > 0) {
        const buyTotal = (strongBuy || 0) + (buy || 0);
        const sellTotal = (sell || 0) + (strongSell || 0);
        const holdTotal = hold || 0;

        if (buyTotal > sellTotal && buyTotal > holdTotal) {
          recommendationKey =
            (strongBuy || 0) > (buy || 0) ? 'strong_buy' : 'buy';
        } else if (sellTotal > buyTotal && sellTotal > holdTotal) {
          recommendationKey =
            (strongSell || 0) > (sell || 0) ? 'sell' : 'underperform';
        } else {
          recommendationKey = 'hold';
        }
      }
    }

    // Parse earnings data (last 4 quarters)
    const earnings: EarningsData[] = [];
    if (Array.isArray(earningsData)) {
      for (const e of earningsData.slice(0, 4)) {
        earnings.push({
          actual: e.actual ?? null,
          estimate: e.estimate ?? null,
          period: e.period ?? null,
          surprise: e.surprise ?? null,
          surprisePercent: e.surprisePercent ?? null,
        });
      }
    }

    // Parse fundamental metrics - all available from Finnhub FREE tier
    const metrics = metricsData?.metric ?? {};
    const fundamentals: FundamentalMetrics = {
      // Valuation
      peRatio: metrics.peBasicExclExtraTTM ?? metrics.peTTM ?? null,
      pbRatio: metrics.pbQuarterly ?? metrics.pbAnnual ?? null,
      psRatio: metrics.psTTM ?? null,
      pegRatio: metrics.pegTTM ?? null,
      evEbitda: metrics.evEbitdaTTM ?? null,
      forwardPe: metrics.forwardPE ?? null,
      // Profitability
      roe: metrics.roeTTM ?? metrics.roeRfy ?? null,
      roa: metrics.roaTTM ?? metrics.roaRfy ?? null,
      roi: metrics.roiTTM ?? metrics.roiAnnual ?? null,
      grossMargin: metrics.grossMarginTTM ?? metrics.grossMargin5Y ?? null,
      operatingMargin:
        metrics.operatingMarginTTM ?? metrics.operatingMargin5Y ?? null,
      netMargin:
        metrics.netProfitMarginTTM ?? metrics.netProfitMargin5Y ?? null,
      // Growth
      revenueGrowth: metrics.revenueGrowthQuarterlyYoy ?? null,
      epsGrowth: metrics.epsGrowthQuarterlyYoy ?? null,
      revenueGrowth3Y: metrics.revenueGrowth3Y ?? null,
      revenueGrowth5Y: metrics.revenueGrowth5Y ?? null,
      epsGrowth5Y: metrics.epsGrowth5Y ?? null,
      // Risk
      beta: metrics.beta ?? null,
      debtToEquity:
        metrics['totalDebt/totalEquityQuarterly'] ??
        metrics['totalDebt/totalEquityAnnual'] ??
        null,
      currentRatio:
        metrics.currentRatioQuarterly ?? metrics.currentRatioAnnual ?? null,
      quickRatio:
        metrics.quickRatioQuarterly ?? metrics.quickRatioAnnual ?? null,
      // Dividend
      dividendYield: metrics.dividendYieldIndicatedAnnual ?? null,
      payoutRatio: metrics.payoutRatioTTM ?? null,
      dividendGrowth5Y: metrics.dividendGrowthRate5Y ?? null,
      // Performance
      return52W: metrics['52WeekPriceReturnDaily'] ?? null,
      return13W: metrics['13WeekPriceReturnDaily'] ?? null,
      returnVsSP500: metrics['priceRelativeToS&P50052Week'] ?? null,
      // Size
      marketCap: metrics.marketCapitalization ?? null,
      enterpriseValue: metrics.enterpriseValue ?? null,
    };

    // Parse insider sentiment - store all monthly data for client-side filtering
    let insiderSentiment: InsiderSentiment | null = null;
    if (
      insiderData?.data &&
      Array.isArray(insiderData.data) &&
      insiderData.data.length > 0
    ) {
      // Sort by year and month descending to get most recent first
      const sortedData = [...insiderData.data].sort(
        (
          a: { year: number; month: number },
          b: { year: number; month: number }
        ) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        }
      );

      // Store all monthly data for client-side filtering
      const monthlyData: InsiderMonthlyData[] = sortedData.map(
        (d: {
          year: number;
          month: number;
          mspr?: number;
          change?: number;
        }) => ({
          year: d.year,
          month: d.month,
          mspr: d.mspr ?? 0,
          change: d.change ?? 0,
        })
      );

      // Calculate default aggregates (last 3 months)
      const recentData = sortedData.slice(0, 3);
      const avgMspr =
        recentData.reduce(
          (sum: number, d: { mspr?: number }) => sum + (d.mspr ?? 0),
          0
        ) / recentData.length;
      const totalChange = recentData.reduce(
        (sum: number, d: { change?: number }) => sum + (d.change ?? 0),
        0
      );
      insiderSentiment = {
        mspr: Math.round(avgMspr * 100) / 100,
        change: totalChange,
        monthlyData,
      };
    }

    // Parse peers (filter out self)
    const peers: string[] = Array.isArray(peersData)
      ? peersData
          .filter((p: string) => p !== finnhubSymbol && p !== ticker)
          .slice(0, 5)
      : [];

    // Parse industry from Finnhub profile (description comes from Yahoo above)
    const industry = profileData?.finnhubIndustry ?? null;

    return {
      ticker,
      stockName,
      currentPrice,
      priceChange,
      priceChangePercent,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      recommendationKey,
      consensusScore,
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
      numberOfAnalysts,
      recommendationPeriod,
      analystTargetPrice,
      earnings,
      fundamentals,
      insiderSentiment,
      peers,
      industry,
      description,
      descriptionSource,
    };
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return { ...baseData, error: String(error) };
  }
}

// Helper functions for date formatting
export function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

// Check if ticker is non-US (has exchange suffix like .DE, .HK, .L)
export function isNonUsTicker(ticker: string): boolean {
  return ticker.includes('.');
}

// US exchanges in Yahoo Search results
const US_EXCHANGES = ['NMS', 'NYQ', 'NGM', 'PCX', 'PNK', 'ASE', 'NCM'];

// Get company name from Yahoo Finance chart endpoint
async function getCompanyName(ticker: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=1d&range=1d`;
    const response = await safeFetch(url, 'yahoo');
    if (!response.ok) return null;

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    return meta?.longName || meta?.shortName || null;
  } catch {
    return null;
  }
}

// Search Yahoo Finance for ticker variants
interface YahooSearchResult {
  symbol: string;
  exchange: string;
  quoteType: string;
  longname?: string;
  shortname?: string;
}

async function yahooSearch(query: string): Promise<YahooSearchResult[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query
    )}&quotesCount=15&newsCount=0`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return [];

    const data = await response.json();
    return data?.quotes || [];
  } catch {
    return [];
  }
}

// Find US ADR ticker for a non-US stock via Yahoo Search
// Flow: VOW3.DE -> "Volkswagen AG" -> search -> VWAGY (PNK exchange)
// Fallback: Try ticker patterns like BOSSY, BOSSF for OTC stocks
async function findUsAdrTicker(yahooTicker: string): Promise<string | null> {
  // Get company name from Yahoo
  const companyName = await getCompanyName(yahooTicker);
  if (!companyName) {
    console.log(`Could not get company name for ${yahooTicker}`);
    return null;
  }

  console.log(`Searching US ADR for ${yahooTicker} (${companyName})`);

  // Strategy 1: Search by company name (works for NYSE/NASDAQ listed ADRs like BABA)
  const results = await yahooSearch(companyName);

  // Find US ticker (no dot in symbol, US exchange)
  const usTicker = results.find(
    (r) =>
      !r.symbol.includes('.') &&
      r.quoteType === 'EQUITY' &&
      US_EXCHANGES.includes(r.exchange)
  );

  if (usTicker) {
    console.log(
      `Found US ADR via name search: ${yahooTicker} -> ${usTicker.symbol} (${usTicker.exchange})`
    );
    return usTicker.symbol;
  }

  // Strategy 2: Try common OTC ticker patterns (for smaller ADRs not found by name)
  // Extract base ticker: VOW3.DE -> VOW3, BOSS.DE -> BOSS
  const baseTicker = yahooTicker.split('.')[0].replace(/[0-9]+$/, ''); // Remove trailing numbers too
  const baseTickerWithNum = yahooTicker.split('.')[0]; // Keep numbers: VOW3

  // Common ADR suffixes: Y (most common), F (sometimes used)
  const patternsToTry = [
    `${baseTicker}Y`, // BOSS -> BOSSY
    `${baseTickerWithNum}Y`, // VOW3 -> VOW3Y (less common)
    `${baseTicker}F`, // BOSS -> BOSSF
  ];

  for (const pattern of patternsToTry) {
    const patternResults = await yahooSearch(pattern);
    const otcMatch = patternResults.find(
      (r) =>
        r.symbol === pattern &&
        r.quoteType === 'EQUITY' &&
        US_EXCHANGES.includes(r.exchange)
    );

    if (otcMatch) {
      console.log(
        `Found US ADR via pattern: ${yahooTicker} -> ${otcMatch.symbol} (${otcMatch.exchange})`
      );
      return otcMatch.symbol;
    }
  }

  console.log(`No US ADR found for ${yahooTicker}`);
  return null;
}

// Convert Yahoo Finance ticker to Finnhub ticker
// For US stocks: use as-is
// For non-US stocks: find US ADR ticker via Yahoo Search
async function yahooToFinnhubTicker(yahooTicker: string): Promise<string> {
  // US ticker (no suffix) - use directly
  if (!isNonUsTicker(yahooTicker)) {
    return yahooTicker;
  }

  // Non-US ticker - try to find US ADR
  const adrTicker = await findUsAdrTicker(yahooTicker);
  return adrTicker || yahooTicker; // Fallback to original if no ADR found
}

// Convert Yahoo Finance ticker to Alpha Vantage ticker
// Alpha Vantage uses different exchange suffixes
export function yahooToAlphaVantageTicker(yahooTicker: string): string {
  // German stocks: ZAL.DE -> ZAL.FRK (Frankfurt)
  if (yahooTicker.endsWith('.DE')) {
    return yahooTicker.replace('.DE', '.FRK');
  }
  // London stocks: LLOY.L -> LLOY.LON
  if (yahooTicker.endsWith('.L')) {
    return yahooTicker.replace('.L', '.LON');
  }
  // Paris stocks: BNP.PA -> BNP.PAR
  if (yahooTicker.endsWith('.PA')) {
    return yahooTicker.replace('.PA', '.PAR');
  }
  // Amsterdam: ASML.AS -> ASML.AMS
  if (yahooTicker.endsWith('.AS')) {
    return yahooTicker.replace('.AS', '.AMS');
  }
  // Swiss: NESN.SW -> Not well supported, try without suffix
  if (yahooTicker.endsWith('.SW')) {
    return yahooTicker.replace('.SW', '');
  }
  // Milan: ENI.MI -> ENI.MIL
  if (yahooTicker.endsWith('.MI')) {
    return yahooTicker.replace('.MI', '.MIL');
  }
  // Madrid: SAN.MC -> Not well supported
  if (yahooTicker.endsWith('.MC')) {
    return yahooTicker.replace('.MC', '');
  }
  // Toronto: TD.TO -> TD.TRT
  if (yahooTicker.endsWith('.TO')) {
    return yahooTicker.replace('.TO', '.TRT');
  }
  // Hong Kong: Not well supported
  if (yahooTicker.endsWith('.HK')) {
    return yahooTicker.replace('.HK', '');
  }
  // US stocks - no change needed
  return yahooTicker;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Reset rate limit tracking for each request
  rateLimitInfo = { finnhub: false, yahoo: false, alpha: false };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get parameters from request body
    // forceRefresh: boolean - skip cache and fetch fresh data
    // refreshTickers: string[] - only clear cache for specific tickers (used with forceRefresh)
    const {
      portfolioId,
      ticker,
      stockName,
      finnhubTicker,
      forceRefresh,
      refreshTickers,
    } = await req.json().catch(() => ({}));

    // If forceRefresh with specific tickers, clear their cache first
    if (forceRefresh && refreshTickers && Array.isArray(refreshTickers)) {
      console.log(
        `[CACHE] Clearing cache for tickers: ${refreshTickers.join(', ')}`
      );
      for (const tickerToClear of refreshTickers) {
        await clearCacheForTicker(supabase, tickerToClear);
      }
    }

    // If single ticker is provided, fetch just that one
    if (ticker) {
      // Clear cache for this ticker if forceRefresh
      if (forceRefresh) {
        const finnhubTickerToClear =
          finnhubTicker || (await yahooToFinnhubTicker(ticker));
        await clearCacheForTicker(supabase, finnhubTickerToClear);
      }

      // Use provided finnhubTicker, or auto-detect US ADR for non-US stocks
      const resolvedFinnhubTicker =
        finnhubTicker || (await yahooToFinnhubTicker(ticker));
      const data = await fetchAnalystData(
        ticker,
        stockName || ticker,
        resolvedFinnhubTicker,
        supabase,
        forceRefresh || false
      );

      return new Response(
        JSON.stringify({
          data: [data],
          errors: data.error ? [data.error] : [],
          rateLimited:
            rateLimitInfo.finnhub || rateLimitInfo.yahoo || rateLimitInfo.alpha
              ? rateLimitInfo
              : undefined,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get holdings for the portfolio
    let holdingsQuery = supabase
      .from('holdings')
      .select('stock_id, ticker, stock_name');

    if (portfolioId) {
      holdingsQuery = holdingsQuery.eq('portfolio_id', portfolioId);
    }

    const { data: holdings, error: holdingsError } = await holdingsQuery;

    if (holdingsError) {
      throw holdingsError;
    }

    if (!holdings || holdings.length === 0) {
      return new Response(JSON.stringify({ data: [], errors: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deduplicate holdings by ticker and get stock IDs
    const uniqueHoldings = Array.from(
      new Map(holdings.map((h) => [h.ticker, h])).values()
    );

    // Fetch finnhub_ticker from stocks table for all unique stock IDs
    const stockIds = uniqueHoldings.map((h) => h.stock_id).filter(Boolean);
    const { data: stocksData } = await supabase
      .from('stocks')
      .select('id, ticker, finnhub_ticker')
      .in('id', stockIds);

    // Create a map of ticker -> finnhub_ticker
    const finnhubTickerMap: Record<string, string | null> = {};
    if (stocksData) {
      for (const stock of stocksData) {
        finnhubTickerMap[stock.ticker] = stock.finnhub_ticker;
      }
    }

    // Fetch analyst data for all tickers
    const results: AnalystData[] = [];
    const errors: string[] = [];

    // Fetch sequentially with delays to avoid rate limiting
    // With caching, most calls should hit cache after first run
    console.log(
      `[START] Fetching analyst data for ${
        uniqueHoldings.length
      } tickers (forceRefresh=${!!forceRefresh})`
    );

    for (let i = 0; i < uniqueHoldings.length; i++) {
      const holding = uniqueHoldings[i];
      // Use finnhub_ticker from DB if available, otherwise auto-detect US ADR
      const resolvedFinnhubTicker =
        finnhubTickerMap[holding.ticker] ||
        (await yahooToFinnhubTicker(holding.ticker));

      console.log(
        `[${i + 1}/${uniqueHoldings.length}] Processing ${
          holding.ticker
        } (finnhub: ${resolvedFinnhubTicker})`
      );

      const data = await fetchAnalystData(
        holding.ticker,
        holding.stock_name,
        resolvedFinnhubTicker,
        supabase,
        forceRefresh || false
      );

      if (data.error) {
        errors.push(`${holding.ticker}: ${data.error}`);
      }

      results.push(data);

      // Longer delay between tickers to spread out API calls
      if (i < uniqueHoldings.length - 1) {
        await delay(TICKER_DELAY_MS);
      }
    }

    console.log(
      `[DONE] Processed ${results.length} tickers, ${errors.length} errors`
    );

    return new Response(
      JSON.stringify({
        data: results,
        errors,
        rateLimited:
          rateLimitInfo.finnhub || rateLimitInfo.yahoo || rateLimitInfo.alpha
            ? rateLimitInfo
            : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
