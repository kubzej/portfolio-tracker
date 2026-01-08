-- =====================================================
-- Fix distance_to_target calculation
-- =====================================================
-- target_price is stored as "quoted" (raw) price, same as what Yahoo shows
-- So it should be compared with raw price, not scaled price

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
    s.price_scale,
    h.total_shares,
    h.avg_buy_price,
    h.total_invested_czk,
    h.target_price,
    h.first_purchase,
    h.last_purchase,
    h.purchase_count,
    -- Raw price from API (before scaling) - this is what Yahoo/IBKR shows
    cp.price AS current_price_raw,
    -- Scaled price (actual price per share for value calculations)
    cp.price * s.price_scale AS current_price,
    cp.exchange_rate_to_czk AS current_exchange_rate,
    cp.price_change * s.price_scale AS price_change,
    cp.price_change_percent,
    cp.volume AS daily_volume,
    cp.avg_volume_20,
    -- Calculate current value in original currency (using scaled price)
    h.total_shares * cp.price * s.price_scale AS current_value,
    -- Calculate current value in CZK (using scaled price)
    h.total_shares * cp.price * s.price_scale * COALESCE(cp.exchange_rate_to_czk, 1) AS current_value_czk,
    -- Calculate unrealized gain in CZK
    (h.total_shares * cp.price * s.price_scale * COALESCE(cp.exchange_rate_to_czk, 1)) - h.total_invested_czk AS unrealized_gain,
    -- Calculate gain percentage
    CASE 
        WHEN h.total_invested_czk > 0 THEN 
            ((h.total_shares * cp.price * s.price_scale * COALESCE(cp.exchange_rate_to_czk, 1)) - h.total_invested_czk) / h.total_invested_czk * 100
        ELSE 0 
    END AS gain_percentage,
    -- Distance to target price (percentage)
    -- target_price is in "quoted" format (same as Yahoo), so compare with raw price
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
