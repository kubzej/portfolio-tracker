// Database types for Portfolio Tracker
// These types mirror the Supabase database schema

export type TransactionType = 'BUY' | 'SELL';

// Portfolio
export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Sector (lookup table)
export interface Sector {
  id: string;
  name: string;
  created_at: string;
}

// Stock (master data)
export interface Stock {
  id: string;
  user_id: string;
  ticker: string;
  name: string;
  sector_id: string | null;
  exchange: string | null;
  currency: string;
  target_price: number | null;
  notes: string | null;
  finnhub_ticker: string | null;
  created_at: string;
  updated_at: string;
}

// Stock with sector name (joined)
export interface StockWithSector extends Stock {
  sector_name?: string;
}

// Transaction (buy/sell record)
export interface Transaction {
  id: string;
  stock_id: string;
  portfolio_id: string;
  date: string; // ISO date string YYYY-MM-DD
  type: TransactionType;
  quantity: number;
  price_per_share: number;
  currency: string;
  exchange_rate_to_czk: number | null;
  fees: number;
  fees_czk: number;
  total_amount: number;
  total_amount_czk: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Transaction with stock info (joined)
export interface TransactionWithStock extends Transaction {
  stock?: Stock;
}

// Current price cache
export interface CurrentPrice {
  id: string;
  stock_id: string;
  price: number;
  currency: string;
  exchange_rate_to_czk: number | null;
  updated_at: string;
}

// Holdings view (calculated from transactions)
export interface Holding {
  user_id: string;
  portfolio_id: string;
  stock_id: string;
  ticker: string;
  stock_name: string;
  currency: string;
  exchange: string | null;
  sector_name: string | null;
  target_price: number | null;
  total_shares: number;
  avg_buy_price: number;
  total_invested_czk: number;
  total_fees: number;
  total_fees_czk: number;
  first_purchase: string | null;
  last_purchase: string | null;
  purchase_count: number;
  sell_count: number;
  realized_gains: number;
}

// Portfolio summary view (holdings + current prices)
export interface PortfolioSummary {
  user_id: string;
  portfolio_id: string;
  portfolio_name: string;
  stock_id: string;
  ticker: string;
  stock_name: string;
  sector_name: string | null;
  exchange: string | null;
  total_shares: number;
  avg_buy_price: number;
  total_invested_czk: number;
  target_price: number | null;
  first_purchase: string | null;
  last_purchase: string | null;
  purchase_count: number;
  current_price: number | null;
  current_exchange_rate: number | null;
  current_value: number | null;
  current_value_czk: number | null;
  unrealized_gain: number | null;
  gain_percentage: number | null;
  distance_to_target_pct: number | null;
}

// ==========================================
// Input types for creating/updating records
// ==========================================

export interface CreateStockInput {
  ticker: string;
  name: string;
  sector_id?: string;
  exchange?: string;
  currency?: string;
  target_price?: number;
  notes?: string;
  finnhub_ticker?: string;
}

export interface UpdateStockInput {
  ticker?: string;
  name?: string;
  sector_id?: string | null;
  exchange?: string | null;
  currency?: string;
  target_price?: number | null;
  notes?: string | null;
  finnhub_ticker?: string | null;
}

export interface CreateTransactionInput {
  stock_id: string;
  portfolio_id: string;
  date: string;
  type: TransactionType;
  quantity: number;
  price_per_share: number;
  currency?: string;
  exchange_rate_to_czk?: number;
  fees?: number;
  notes?: string;
}

export interface UpdateTransactionInput {
  date?: string;
  type?: TransactionType;
  quantity?: number;
  price_per_share?: number;
  currency?: string;
  exchange_rate_to_czk?: number | null;
  fees?: number;
  notes?: string | null;
}

export interface UpdateCurrentPriceInput {
  stock_id: string;
  price: number;
  currency?: string;
  exchange_rate_to_czk?: number;
}

export interface CreatePortfolioInput {
  name: string;
  description?: string;
  color?: string;
  is_default?: boolean;
}

export interface UpdatePortfolioInput {
  name?: string;
  description?: string | null;
  color?: string;
  is_default?: boolean;
}

// ==========================================
// Portfolio totals (for dashboard)
// ==========================================

export interface PortfolioTotals {
  totalInvestedCzk: number;
  totalCurrentValueCzk: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercentage: number;
  totalRealizedGains: number;
  stockCount: number;
  sectorDistribution: {
    sector: string;
    value: number;
    percentage: number;
  }[];
}

// ==========================================
// Watchlists
// ==========================================

// Watchlist (similar to Portfolio but for tracking only)
export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

// Watchlist item (stock in a watchlist)
export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  ticker: string;
  name: string | null;
  finnhub_ticker: string | null;
  target_buy_price: number | null;
  target_sell_price: number | null;
  notes: string | null;
  // Cached price data
  last_price: number | null;
  last_price_change: number | null;
  last_price_change_percent: number | null;
  last_price_updated_at: string | null;
  currency: string; // Currency of the price (USD, EUR, etc.)
  // Timestamps
  added_at: string;
  updated_at: string;
}

// Watchlist with item count (from view)
export interface WatchlistSummary extends Watchlist {
  item_count: number;
  items_at_buy_target: number;
  items_at_sell_target: number;
}

// Watchlist item with calculated fields
export interface WatchlistItemWithCalculations extends WatchlistItem {
  // Distance to targets (calculated client-side)
  distance_to_buy_target: number | null; // % difference from buy target
  distance_to_sell_target: number | null; // % difference from sell target
  // Flags for UI highlighting
  at_buy_target: boolean;
  at_sell_target: boolean;
  // 52-week range (from price API)
  week_52_low: number | null;
  week_52_high: number | null;
}

// ==========================================
// Watchlist Input types
// ==========================================

export interface CreateWatchlistInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateWatchlistInput {
  name?: string;
  description?: string | null;
  color?: string;
}

export interface AddWatchlistItemInput {
  watchlist_id: string;
  ticker: string;
  name?: string;
  finnhub_ticker?: string;
  target_buy_price?: number;
  target_sell_price?: number;
  notes?: string;
}

export interface UpdateWatchlistItemInput {
  ticker?: string;
  name?: string;
  finnhub_ticker?: string | null;
  target_buy_price?: number | null;
  target_sell_price?: number | null;
  notes?: string | null;
  // Price cache update (from API)
  last_price?: number;
  last_price_change?: number;
  last_price_change_percent?: number;
  last_price_updated_at?: string;
}
