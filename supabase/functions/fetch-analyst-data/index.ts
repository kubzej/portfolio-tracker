// Supabase Edge Function for fetching analyst data from Finnhub + Yahoo Finance
// Deploy with: supabase functions deploy fetch-analyst-data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY') ?? '';
const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY') ?? '';

// Rate limit tracking
let rateLimitInfo = { finnhub: false, yahoo: false, alpha: false };

// Safe fetch with rate limit detection and proper headers
async function safeFetch(
  url: string,
  source: 'finnhub' | 'yahoo'
): Promise<Response> {
  const headers: Record<string, string> = {};

  // Yahoo requires User-Agent header
  if (source === 'yahoo') {
    headers['User-Agent'] =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  }

  const response = await fetch(url, { headers });
  if (response.status === 429) {
    rateLimitInfo[source] = true;
    console.warn(`Rate limited by ${source}: ${url}`);
  }
  return response;
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

async function fetchAnalystData(
  ticker: string,
  stockName: string,
  finnhubTicker?: string
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
    // Fetch data from multiple Finnhub endpoints in parallel
    // Note: price-target is PREMIUM so we skip it, recommendation and quote are FREE
    const [
      recommendationRes,
      quoteRes,
      earningsRes,
      metricsRes,
      peersRes,
      profileRes,
      insiderRes,
    ] = await Promise.all([
      // Recommendation trends endpoint (FREE)
      safeFetch(
        `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      ),
      // Quote endpoint for current price (FREE)
      safeFetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      ),
      // Earnings surprises - last 4 quarters (FREE)
      safeFetch(
        `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      ),
      // Basic financials/metrics (FREE)
      safeFetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&metric=all&token=${FINNHUB_API_KEY}`,
        'finnhub'
      ),
      // Company peers (FREE)
      safeFetch(
        `https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      ),
      // Company profile (FREE version)
      safeFetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      ),
      // Insider sentiment (FREE) - get last 12 months for better coverage
      safeFetch(
        `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${encodeURIComponent(
          finnhubSymbol
        )}&from=${getDateMonthsAgo(
          12
        )}&to=${getTodayDate()}&token=${FINNHUB_API_KEY}`,
        'finnhub'
      ),
    ]);

    // Parse responses
    const recommendations = recommendationRes.ok
      ? await recommendationRes.json()
      : null;
    const quote = quoteRes.ok ? await quoteRes.json() : null;
    const earningsData = earningsRes.ok ? await earningsRes.json() : null;
    const metricsData = metricsRes.ok ? await metricsRes.json() : null;
    const peersData = peersRes.ok ? await peersRes.json() : null;
    const profileData = profileRes.ok ? await profileRes.json() : null;
    const insiderData = insiderRes.ok ? await insiderRes.json() : null;

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
    let description: string | null = null;
    let descriptionSource: 'alpha' | null = null;
    console.log(
      `Alpha Vantage: key=${
        ALPHA_VANTAGE_API_KEY ? 'present' : 'missing'
      }, ticker=${ticker}`
    );
    if (ALPHA_VANTAGE_API_KEY) {
      try {
        const alphaSymbol = yahooToAlphaVantageTicker(ticker);
        const alphaUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(
          alphaSymbol
        )}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        console.log(`Fetching Alpha Vantage: ${alphaSymbol}`);
        const alphaRes = await fetch(alphaUrl);

        if (alphaRes.ok) {
          const alphaData = await alphaRes.json();
          console.log(
            `Alpha Vantage response: keys=${
              Object.keys(alphaData).length
            }, data=${JSON.stringify(alphaData).substring(0, 200)}`
          );
          if (alphaData?.Description && !alphaData?.Note) {
            description = alphaData.Description;
            descriptionSource = 'alpha';
            console.log(`Got description: ${description?.substring(0, 50)}...`);
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
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

// Convert Yahoo Finance ticker to Finnhub ticker
// Finnhub uses different formats for non-US stocks
function yahooToFinnhubTicker(yahooTicker: string): string {
  // German stocks: ZAL.DE -> ZAL (XETRA)
  if (yahooTicker.endsWith('.DE')) {
    return yahooTicker.replace('.DE', '');
  }
  // London stocks: LLOY.L -> LLOY
  if (yahooTicker.endsWith('.L')) {
    return yahooTicker.replace('.L', '');
  }
  // Paris stocks: BNP.PA -> BNP
  if (yahooTicker.endsWith('.PA')) {
    return yahooTicker.replace('.PA', '');
  }
  // Amsterdam: ASML.AS -> ASML
  if (yahooTicker.endsWith('.AS')) {
    return yahooTicker.replace('.AS', '');
  }
  // Swiss: NESN.SW -> NESN
  if (yahooTicker.endsWith('.SW')) {
    return yahooTicker.replace('.SW', '');
  }
  // Milan: ENI.MI -> ENI
  if (yahooTicker.endsWith('.MI')) {
    return yahooTicker.replace('.MI', '');
  }
  // Madrid: SAN.MC -> SAN
  if (yahooTicker.endsWith('.MC')) {
    return yahooTicker.replace('.MC', '');
  }
  // Toronto: TD.TO -> TD
  if (yahooTicker.endsWith('.TO')) {
    return yahooTicker.replace('.TO', '');
  }
  // Hong Kong: 0005.HK -> 5 (Finnhub uses different format)
  if (yahooTicker.endsWith('.HK')) {
    const num = yahooTicker.replace('.HK', '').replace(/^0+/, '');
    return num + '.HK'; // Keep .HK for Finnhub
  }
  // US stocks - no change needed
  return yahooTicker;
}

// Convert Yahoo Finance ticker to Alpha Vantage ticker
// Alpha Vantage uses different exchange suffixes
function yahooToAlphaVantageTicker(yahooTicker: string): string {
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
  rateLimitInfo = { finnhub: false, yahoo: false };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get parameters from request body
    const { portfolioId, ticker, stockName, finnhubTicker } = await req
      .json()
      .catch(() => ({}));

    // If single ticker is provided, fetch just that one
    if (ticker) {
      const data = await fetchAnalystData(
        ticker,
        stockName || ticker,
        finnhubTicker || yahooToFinnhubTicker(ticker)
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

    // Fetch in batches to avoid rate limiting
    for (const holding of uniqueHoldings) {
      // Use finnhub_ticker from DB if available, otherwise derive from Yahoo ticker
      const finnhubTicker =
        finnhubTickerMap[holding.ticker] ||
        yahooToFinnhubTicker(holding.ticker);

      const data = await fetchAnalystData(
        holding.ticker,
        holding.stock_name,
        finnhubTicker
      );

      if (data.error) {
        errors.push(`${holding.ticker}: ${data.error}`);
      }

      results.push(data);

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
