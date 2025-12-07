// Supabase Edge Function for fetching option prices from Yahoo Finance
// Deploy with: supabase functions deploy fetch-option-prices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface OptionQuote {
  optionSymbol: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  openInterest: number | null;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  underlyingPrice: number | null;
}

interface YahooOptionContract {
  contractSymbol: string;
  strike: number;
  currency: string;
  lastPrice: number;
  change: number;
  percentChange: number;
  volume: number;
  openInterest: number;
  bid: number;
  ask: number;
  contractSize: string;
  expiration: number;
  lastTradeDate: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

interface YahooOptionsChain {
  optionChain: {
    result: Array<{
      underlyingSymbol: string;
      expirationDates: number[];
      strikes: number[];
      quote: {
        regularMarketPrice: number;
        symbol: string;
      };
      options: Array<{
        expirationDate: number;
        calls: YahooOptionContract[];
        puts: YahooOptionContract[];
      }>;
    }>;
    error: null | { code: string; description: string };
  };
}

/**
 * Parse OCC option symbol to extract components
 * Handles both formats:
 * - Without spaces: AAPL250117C00150000
 * - With spaces (legacy): AAPL  250117C00150000
 */
function parseOccSymbol(occSymbol: string): {
  symbol: string;
  expiration: Date;
  type: 'call' | 'put';
  strike: number;
} | null {
  // Remove any whitespace from the symbol
  const cleanSymbol = occSymbol.replace(/\s/g, '');

  // OCC format regex: 1-6 char symbol + 6 digit date + C/P + 8 digit strike
  const match = cleanSymbol.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/);
  if (!match) {
    console.error(
      `Invalid OCC symbol format: ${occSymbol} (cleaned: ${cleanSymbol})`
    );
    return null;
  }

  const [, symbol, dateStr, typeChar, strikeStr] = match;

  // Parse date (YYMMDD)
  const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10) - 1; // 0-indexed
  const day = parseInt(dateStr.substring(4, 6), 10);
  const expiration = new Date(year, month, day);

  // Parse type
  const type = typeChar === 'C' ? 'call' : 'put';

  // Parse strike (divide by 1000)
  const strike = parseInt(strikeStr, 10) / 1000;

  return { symbol, expiration, type, strike };
}

/**
 * Fetch direct quote for option using OCC symbol via Yahoo Finance chart API
 * This is more reliable than searching through options chain
 */
interface DirectQuoteResult {
  price: number | null;
  previousClose: number | null;
  volume: number | null;
  currency: string;
  longName: string | null;
}

async function fetchDirectOptionQuote(
  occSymbol: string
): Promise<DirectQuoteResult | null> {
  try {
    // Use the v8 chart API which works well for option symbols
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      occSymbol
    )}?interval=1d&range=1d`;

    console.log(`Fetching direct quote for: ${occSymbol}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch direct quote for ${occSymbol}: ${response.status}`
      );
      return null;
    }

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (!meta) {
      console.error(`No meta data in response for ${occSymbol}`);
      return null;
    }

    console.log(`Got quote for ${occSymbol}: price=${meta.regularMarketPrice}`);

    return {
      price: meta.regularMarketPrice ?? null,
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      volume: meta.regularMarketVolume ?? null,
      currency: meta.currency || 'USD',
      longName: meta.longName ?? null,
    };
  } catch (error) {
    console.error(`Error fetching direct quote for ${occSymbol}:`, error);
    return null;
  }
}

/**
 * Fetch underlying stock price
 */
async function fetchUnderlyingPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=1d&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch options chain from Yahoo Finance (used as fallback for Greeks data)
 */
async function fetchYahooOptionsChain(
  symbol: string,
  expirationTimestamp?: number
): Promise<YahooOptionsChain | null> {
  try {
    let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(
      symbol
    )}`;
    if (expirationTimestamp) {
      url += `?date=${expirationTimestamp}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch options chain for ${symbol}: ${response.status}`
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching options chain for ${symbol}:`, error);
    return null;
  }
}

/**
 * Find specific option contract in Yahoo chain
 */
function findOptionInChain(
  chain: YahooOptionsChain,
  strike: number,
  type: 'call' | 'put',
  expirationTimestamp: number
): YahooOptionContract | null {
  const result = chain.optionChain?.result?.[0];
  if (!result?.options?.length) return null;

  // Find the right expiration
  const optionData = result.options.find(
    (opt) => opt.expirationDate === expirationTimestamp
  );
  if (!optionData) return null;

  // Get calls or puts array
  const contracts = type === 'call' ? optionData.calls : optionData.puts;
  if (!contracts?.length) return null;

  // Find matching strike
  return contracts.find((c) => Math.abs(c.strike - strike) < 0.01) || null;
}

/**
 * Estimate Greeks based on available data
 * These are rough estimates - real Greeks require Black-Scholes
 */
function estimateGreeksSimple(
  optionPrice: number,
  strike: number,
  underlyingPrice: number,
  type: 'call' | 'put',
  daysToExpiry: number,
  impliedVolatility = 0.3
): { delta: number; gamma: number; theta: number; vega: number } {
  const moneyness = underlyingPrice / strike;
  const iv = impliedVolatility;
  const timeToExpiry = Math.max(daysToExpiry / 365, 0.001);

  // Very rough delta approximation based on moneyness
  let delta: number;
  if (type === 'call') {
    if (moneyness > 1.1) delta = 0.9; // Deep ITM
    else if (moneyness > 1.02) delta = 0.7; // ITM
    else if (moneyness > 0.98) delta = 0.5; // ATM
    else if (moneyness > 0.9) delta = 0.3; // OTM
    else delta = 0.1; // Deep OTM
  } else {
    if (moneyness < 0.9) delta = -0.9; // Deep ITM put
    else if (moneyness < 0.98) delta = -0.7;
    else if (moneyness < 1.02) delta = -0.5;
    else if (moneyness < 1.1) delta = -0.3;
    else delta = -0.1;
  }

  // Rough gamma - highest ATM, decreases away from strike
  const gamma =
    (0.1 * Math.exp(-Math.pow(moneyness - 1, 2) * 50)) /
    Math.sqrt(timeToExpiry);

  // Rough theta - time decay per day
  const theta = -(optionPrice * iv * 0.5) / Math.sqrt(timeToExpiry * 365) / 365;

  // Rough vega - sensitivity to IV
  const vega = underlyingPrice * Math.sqrt(timeToExpiry) * 0.01;

  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
  };
}

/**
 * Fetch option quote for a specific OCC symbol
 * Uses direct quote API first, falls back to options chain
 */
async function fetchOptionQuote(
  occSymbol: string
): Promise<OptionQuote | null> {
  const parsed = parseOccSymbol(occSymbol);
  if (!parsed) return null;

  const { symbol, expiration, type, strike } = parsed;

  // Calculate days to expiry
  const now = new Date();
  const daysToExpiry = Math.max(
    0,
    Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Try direct quote first (more reliable for finding options)
  const directQuote = await fetchDirectOptionQuote(occSymbol);

  if (directQuote && directQuote.price !== null) {
    console.log(`Direct quote success for ${occSymbol}: $${directQuote.price}`);

    // Fetch underlying price for Greeks calculation
    const underlyingPrice = await fetchUnderlyingPrice(symbol);

    // Estimate Greeks
    const greeks =
      underlyingPrice && directQuote.price
        ? estimateGreeksSimple(
            directQuote.price,
            strike,
            underlyingPrice,
            type,
            daysToExpiry
          )
        : { delta: null, gamma: null, theta: null, vega: null };

    return {
      optionSymbol: occSymbol,
      price: directQuote.price,
      bid: null, // Not available from direct quote
      ask: null,
      volume: directQuote.volume,
      openInterest: null,
      impliedVolatility: null,
      delta: greeks.delta,
      gamma: greeks.gamma,
      theta: greeks.theta,
      vega: greeks.vega,
      underlyingPrice: underlyingPrice,
    };
  }

  console.log(`Direct quote failed for ${occSymbol}, trying options chain...`);

  // Fall back to options chain
  const expirationTimestamp = Math.floor(expiration.getTime() / 1000);
  const chain = await fetchYahooOptionsChain(symbol, expirationTimestamp);

  if (!chain) {
    console.log(`Options chain also failed for ${occSymbol}`);
    return null;
  }

  const underlyingPrice =
    chain.optionChain?.result?.[0]?.quote?.regularMarketPrice;

  // Find the specific contract
  const contract = findOptionInChain(chain, strike, type, expirationTimestamp);

  if (!contract) {
    console.log(
      `Contract not found in chain: ${occSymbol} (strike=${strike}, type=${type})`
    );
    // Return partial data with underlying price at least
    return {
      optionSymbol: occSymbol,
      price: null,
      bid: null,
      ask: null,
      volume: null,
      openInterest: null,
      impliedVolatility: null,
      delta: null,
      gamma: null,
      theta: null,
      vega: null,
      underlyingPrice: underlyingPrice || null,
    };
  }

  // Use contract data with Greeks
  const greeks = underlyingPrice
    ? estimateGreeksSimple(
        (contract.bid + contract.ask) / 2 || contract.lastPrice,
        strike,
        underlyingPrice,
        type,
        daysToExpiry,
        contract.impliedVolatility
      )
    : { delta: null, gamma: null, theta: null, vega: null };

  return {
    optionSymbol: occSymbol,
    price: (contract.bid + contract.ask) / 2 || contract.lastPrice || null,
    bid: contract.bid || null,
    ask: contract.ask || null,
    volume: contract.volume || null,
    openInterest: contract.openInterest || null,
    impliedVolatility: contract.impliedVolatility || null,
    delta: greeks.delta,
    gamma: greeks.gamma,
    theta: greeks.theta,
    vega: greeks.vega,
    underlyingPrice: underlyingPrice || null,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional filtering
    let portfolioId: string | null = null;
    let optionSymbols: string[] | null = null;

    if (req.method === 'POST') {
      const body = await req.json();
      portfolioId = body.portfolioId || null;
      optionSymbols = body.optionSymbols || null;
    }

    // Get option symbols to fetch
    let symbols: string[];

    if (optionSymbols && optionSymbols.length > 0) {
      // Use provided symbols
      symbols = optionSymbols;
    } else {
      // Get from option_holdings view
      let query = supabase.from('option_holdings').select('option_symbol');

      if (portfolioId) {
        query = query.eq('portfolio_id', portfolioId);
      }

      const { data: holdings, error: holdingsError } = await query;

      if (holdingsError) {
        throw holdingsError;
      }

      if (!holdings || holdings.length === 0) {
        return new Response(
          JSON.stringify({
            message: 'No option holdings to update',
            updated: 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      symbols = [...new Set(holdings.map((h) => h.option_symbol))];
    }

    console.log(`Fetching prices for ${symbols.length} options...`);

    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
      quotes: [] as OptionQuote[],
    };

    // Group symbols by underlying to minimize API calls
    const symbolsByUnderlying = new Map<string, string[]>();
    for (const occSymbol of symbols) {
      const parsed = parseOccSymbol(occSymbol);
      if (parsed) {
        const existing = symbolsByUnderlying.get(parsed.symbol) || [];
        existing.push(occSymbol);
        symbolsByUnderlying.set(parsed.symbol, existing);
      }
    }

    // Fetch quotes (with rate limiting)
    for (const occSymbol of symbols) {
      try {
        const quote = await fetchOptionQuote(occSymbol);

        if (quote && quote.price !== null) {
          // Upsert to option_prices table
          const { error: upsertError } = await supabase
            .from('option_prices')
            .upsert(
              {
                option_symbol: quote.optionSymbol,
                price: quote.price,
                bid: quote.bid,
                ask: quote.ask,
                volume: quote.volume,
                open_interest: quote.openInterest,
                implied_volatility: quote.impliedVolatility,
                delta: quote.delta,
                gamma: quote.gamma,
                theta: quote.theta,
                vega: quote.vega,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'option_symbol',
              }
            );

          if (upsertError) {
            console.error(`Failed to upsert ${occSymbol}:`, upsertError);
            results.failed++;
            results.errors.push(`${occSymbol}: ${upsertError.message}`);
          } else {
            results.updated++;
            results.quotes.push(quote);
          }
        } else {
          results.failed++;
          results.errors.push(`${occSymbol}: No price data available`);
        }

        // Rate limiting: 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing ${occSymbol}:`, error);
        results.failed++;
        results.errors.push(
          `${occSymbol}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-option-prices:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
