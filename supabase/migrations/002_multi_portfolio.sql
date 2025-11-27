-- =====================================================
-- Multi-Portfolio Support Migration
-- Run this in Supabase SQL Editor after 001_initial_schema.sql
-- =====================================================

-- 1. PORTFOLIOS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#646cff', -- hex color for UI
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default portfolio "SWING IBKR"
INSERT INTO portfolios (name, description, is_default)
VALUES ('SWING IBKR', 'Interactive Brokers swing trading portfolio', TRUE)
ON CONFLICT DO NOTHING;

-- 2. ADD PORTFOLIO_ID TO TRANSACTIONS
-- =====================================================
-- Add column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'portfolio_id'
    ) THEN
        ALTER TABLE transactions ADD COLUMN portfolio_id UUID REFERENCES portfolios(id);
    END IF;
END $$;

-- Assign all existing transactions to the default portfolio
UPDATE transactions 
SET portfolio_id = (SELECT id FROM portfolios WHERE is_default = TRUE LIMIT 1)
WHERE portfolio_id IS NULL;

-- Make portfolio_id NOT NULL after migrating existing data
ALTER TABLE transactions ALTER COLUMN portfolio_id SET NOT NULL;

-- Add index for faster queries by portfolio
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON transactions(portfolio_id);

-- 3. UPDATE HOLDINGS VIEW TO INCLUDE PORTFOLIO
-- =====================================================
DROP VIEW IF EXISTS portfolio_summary CASCADE;
DROP VIEW IF EXISTS holdings CASCADE;

CREATE OR REPLACE VIEW holdings AS
WITH transaction_summary AS (
    SELECT 
        t.portfolio_id,
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
    GROUP BY t.portfolio_id, t.stock_id, s.ticker, s.name, s.currency, s.exchange, s.target_price, sec.name
)
SELECT 
    portfolio_id,
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

-- 4. UPDATE PORTFOLIO SUMMARY VIEW
-- =====================================================
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT 
    h.portfolio_id,
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

-- 5. HELPER FUNCTION TO GET DEFAULT PORTFOLIO
-- =====================================================
CREATE OR REPLACE FUNCTION get_default_portfolio_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM portfolios WHERE is_default = TRUE LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- 6. UPDATE TRIGGER FOR PORTFOLIOS
-- =====================================================
CREATE OR REPLACE FUNCTION update_portfolio_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_portfolio_timestamp ON portfolios;
CREATE TRIGGER update_portfolio_timestamp
    BEFORE UPDATE ON portfolios
    FOR EACH ROW
    EXECUTE FUNCTION update_portfolio_timestamp();

-- Done! All existing transactions are now part of "SWING IBKR" portfolio.
