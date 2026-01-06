-- =====================================================
-- Add daily volume to current_prices + portfolio_summary
-- =====================================================

-- Add daily volume (from Yahoo regularMarketVolume)
ALTER TABLE current_prices
ADD COLUMN IF NOT EXISTS volume DECIMAL(20, 0);

-- Add 20D average volume (computed in fetch-prices edge function)
ALTER TABLE current_prices
ADD COLUMN IF NOT EXISTS avg_volume_20 DECIMAL(20, 0);

-- Update portfolio_summary view to include daily volume
DROP VIEW IF EXISTS portfolio_summary;

CREATE VIEW portfolio_summary
WITH (security_invoker = true) AS
SELECT 
    p.user_id,
    h.portfolio_id,
    p.name AS portfolio_name,
    h.stock_id,
    h.ticker,
    h.stock_name,
    h.sector_name,
    h.exchange,
    s.country,
    h.total_shares,
    h.avg_buy_price,
    h.total_invested_czk,
    h.target_price,
    h.first_purchase,
    h.last_purchase,
    h.purchase_count,
    cp.price AS current_price,
    cp.exchange_rate_to_czk AS current_exchange_rate,
    cp.price_change,
    cp.price_change_percent,
    cp.volume AS daily_volume,
    cp.avg_volume_20,
    -- Calculate current value in original currency
    h.total_shares * cp.price AS current_value,
    -- Calculate current value in CZK
    h.total_shares * cp.price * COALESCE(cp.exchange_rate_to_czk, 1) AS current_value_czk,
    -- Calculate unrealized gain in CZK
    (h.total_shares * cp.price * COALESCE(cp.exchange_rate_to_czk, 1)) - h.total_invested_czk AS unrealized_gain,
    -- Calculate gain percentage
    CASE 
        WHEN h.total_invested_czk > 0 THEN 
            ((h.total_shares * cp.price * COALESCE(cp.exchange_rate_to_czk, 1)) - h.total_invested_czk) / h.total_invested_czk * 100
        ELSE 0 
    END AS gain_percentage,
    -- Distance to target price (percentage)
    CASE 
        WHEN h.target_price IS NOT NULL AND cp.price IS NOT NULL AND cp.price > 0 THEN
            ((h.target_price - cp.price) / cp.price) * 100
        ELSE NULL
    END AS distance_to_target_pct
FROM holdings h
JOIN portfolios p ON h.portfolio_id = p.id
JOIN stocks s ON h.stock_id = s.id
LEFT JOIN current_prices cp ON h.stock_id = cp.stock_id
WHERE h.total_shares > 0;

-- Grant access
GRANT SELECT ON portfolio_summary TO authenticated;
