// Database types for Portfolio Tracker
// These types mirror the Supabase database schema

export type TransactionType = 'BUY' | 'SELL';

// Portfolio
export interface Portfolio {
  id: string;
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
  ticker: string;
  name: string;
  sector_id: string | null;
  exchange: string | null;
  currency: string;
  target_price: number | null;
  notes: string | null;
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
  portfolio_id: string;
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
}

export interface UpdateStockInput {
  ticker?: string;
  name?: string;
  sector_id?: string | null;
  exchange?: string | null;
  currency?: string;
  target_price?: number | null;
  notes?: string | null;
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
