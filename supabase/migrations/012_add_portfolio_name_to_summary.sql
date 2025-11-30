-- Migration: Add portfolio_name to portfolio_summary view
-- This allows distinguishing holdings when viewing "All Portfolios"

-- Drop and recreate portfolio_summary view with portfolio_name
DROP VIEW IF EXISTS portfolio_summary;

CREATE VIEW portfolio_summary AS
SELECT 
    h.portfolio_id,
    p.name AS portfolio_name,
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
JOIN portfolios p ON h.portfolio_id = p.id
LEFT JOIN current_prices cp ON h.stock_id = cp.stock_id;
