-- =====================================================
-- Portfolio Tracker Database Schema
-- Run this in Supabase SQL Editor (SQL Editor -> New Query)
-- =====================================================

-- 1. SECTORS TABLE (lookup table for stock sectors)
-- =====================================================
CREATE TABLE IF NOT EXISTS sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common sectors
INSERT INTO sectors (name) VALUES
    ('Technology'),
    ('Healthcare'),
    ('Financial Services'),
    ('Consumer Cyclical'),
    ('Consumer Defensive'),
    ('Energy'),
    ('Industrials'),
    ('Basic Materials'),
    ('Real Estate'),
    ('Utilities'),
    ('Communication Services'),
    ('Other')
ON CONFLICT (name) DO NOTHING;

-- 2. STOCKS TABLE (master data for each stock)
-- =====================================================
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    sector_id UUID REFERENCES sectors(id),
    exchange VARCHAR(50), -- e.g., NYSE, NASDAQ, XETRA
    currency VARCHAR(3) DEFAULT 'USD', -- trading currency
    target_price DECIMAL(15, 4), -- your target price for the stock
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRANSACTIONS TABLE (every buy/sell as a record)
-- =====================================================
CREATE TYPE transaction_type AS ENUM ('BUY', 'SELL');

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type transaction_type NOT NULL,
    quantity DECIMAL(15, 6) NOT NULL, -- supports fractional shares
    price_per_share DECIMAL(15, 4) NOT NULL, -- price in original currency
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate_to_czk DECIMAL(15, 6), -- exchange rate at time of transaction
    fees DECIMAL(15, 4) DEFAULT 0, -- fees in original currency
    fees_czk DECIMAL(15, 4) DEFAULT 0, -- fees converted to CZK
    total_amount DECIMAL(15, 4), -- quantity * price_per_share (auto-calculated)
    total_amount_czk DECIMAL(15, 4), -- total in CZK (auto-calculated)
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HOLDINGS VIEW (calculated from transactions)
-- =====================================================
-- This view automatically calculates current holdings from all transactions
CREATE OR REPLACE VIEW holdings AS
WITH transaction_summary AS (
    SELECT 
        t.stock_id,
        s.ticker,
        s.name AS stock_name,
        s.currency,
        s.exchange,
        s.target_price,
        sec.name AS sector_name,
        
        -- Calculate total shares (BUY adds, SELL subtracts)
        SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END) AS total_shares,
        
        -- Calculate total invested (only from BUY transactions)
        SUM(CASE WHEN t.type = 'BUY' THEN t.quantity * t.price_per_share ELSE 0 END) AS total_buy_amount,
        SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE 0 END) AS total_buy_shares,
        
        -- Calculate total sold
        SUM(CASE WHEN t.type = 'SELL' THEN t.quantity * t.price_per_share ELSE 0 END) AS total_sell_amount,
        SUM(CASE WHEN t.type = 'SELL' THEN t.quantity ELSE 0 END) AS total_sell_shares,
        
        -- Total invested in CZK
        SUM(CASE WHEN t.type = 'BUY' THEN t.total_amount_czk ELSE 0 END) AS total_invested_czk,
        
        -- Total fees
        SUM(t.fees) AS total_fees,
        SUM(t.fees_czk) AS total_fees_czk,
        
        -- Dates
        MIN(CASE WHEN t.type = 'BUY' THEN t.date END) AS first_purchase,
        MAX(CASE WHEN t.type = 'BUY' THEN t.date END) AS last_purchase,
        
        -- Count of purchases
        COUNT(CASE WHEN t.type = 'BUY' THEN 1 END) AS purchase_count,
        COUNT(CASE WHEN t.type = 'SELL' THEN 1 END) AS sell_count
        
    FROM transactions t
    JOIN stocks s ON t.stock_id = s.id
    LEFT JOIN sectors sec ON s.sector_id = sec.id
    GROUP BY t.stock_id, s.ticker, s.name, s.currency, s.exchange, s.target_price, sec.name
)
SELECT 
    stock_id,
    ticker,
    stock_name,
    currency,
    exchange,
    sector_name,
    target_price,
    total_shares,
    -- Average buy price (only if we still have shares)
    CASE 
        WHEN total_buy_shares > 0 THEN total_buy_amount / total_buy_shares 
        ELSE 0 
    END AS avg_buy_price,
    total_invested_czk,
    total_fees,
    total_fees_czk,
    first_purchase,
    last_purchase,
    purchase_count,
    sell_count,
    total_sell_amount AS realized_gains
FROM transaction_summary
WHERE total_shares > 0; -- Only show stocks we still hold

-- 5. CURRENT PRICES TABLE (for caching current stock prices)
-- =====================================================
CREATE TABLE IF NOT EXISTS current_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE UNIQUE,
    price DECIMAL(15, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate_to_czk DECIMAL(15, 6),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PORTFOLIO SUMMARY VIEW
-- =====================================================
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT 
    h.stock_id,
    h.ticker,
    h.stock_name,
    h.sector_name,
    h.exchange,
    h.total_shares,
    h.avg_buy_price,
    h.total_invested_czk,
    h.target_price,
    h.first_purchase,
    h.last_purchase,
    h.purchase_count,
    cp.price AS current_price,
    cp.exchange_rate_to_czk AS current_exchange_rate,
    -- Current value calculations
    (h.total_shares * cp.price) AS current_value,
    (h.total_shares * cp.price * COALESCE(cp.exchange_rate_to_czk, 1)) AS current_value_czk,
    -- Profit/Loss
    ((h.total_shares * cp.price) - (h.total_shares * h.avg_buy_price)) AS unrealized_gain,
    -- Percentage gain
    CASE 
        WHEN h.avg_buy_price > 0 THEN 
            ((cp.price - h.avg_buy_price) / h.avg_buy_price * 100)
        ELSE 0 
    END AS gain_percentage,
    -- Distance to target
    CASE 
        WHEN h.target_price > 0 AND cp.price > 0 THEN 
            ((h.target_price - cp.price) / cp.price * 100)
        ELSE NULL 
    END AS distance_to_target_pct
FROM holdings h
LEFT JOIN current_prices cp ON h.stock_id = cp.stock_id;

-- 7. TRIGGERS FOR AUTO-CALCULATIONS
-- =====================================================

-- Auto-calculate total_amount on transaction insert/update
CREATE OR REPLACE FUNCTION calculate_transaction_totals()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_amount := NEW.quantity * NEW.price_per_share;
    NEW.total_amount_czk := NEW.total_amount * COALESCE(NEW.exchange_rate_to_czk, 1);
    NEW.fees_czk := NEW.fees * COALESCE(NEW.exchange_rate_to_czk, 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_transaction_totals
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_transaction_totals();

-- Auto-update updated_at on stocks
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_stocks_updated_at
    BEFORE UPDATE ON stocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 8. ROW LEVEL SECURITY (optional, for multi-user)
-- =====================================================
-- For now, we'll enable RLS but allow all operations
-- You can add user-specific policies later

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_prices ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (single user app)
CREATE POLICY "Allow all for sectors" ON sectors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for stocks" ON stocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for current_prices" ON current_prices FOR ALL USING (true) WITH CHECK (true);

-- 9. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_transactions_stock_id ON transactions(stock_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks(ticker);
CREATE INDEX IF NOT EXISTS idx_stocks_sector ON stocks(sector_id);
