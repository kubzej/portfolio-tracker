-- Migration: Fix holdings calculation after SELL transactions
-- Problem: avg_buy_price and total_invested were calculated from ALL buys,
-- not just remaining shares. This fix calculates based on remaining lots.
-- =====================================================

-- Drop dependent views first
DROP VIEW IF EXISTS portfolio_summary CASCADE;
DROP VIEW IF EXISTS holdings CASCADE;

-- Recreate holdings view with correct calculations and security_invoker
CREATE VIEW holdings
WITH (security_invoker = true) AS
WITH 
-- First, calculate remaining shares per lot (BUY transaction)
lot_remaining AS (
    SELECT 
        buy.id AS lot_id,
        buy.portfolio_id,
        buy.stock_id,
        buy.date AS buy_date,
        buy.quantity AS original_quantity,
        buy.price_per_share,
        buy.currency,
        buy.total_amount_czk,
        buy.exchange_rate_to_czk,
        -- Subtract sold quantities from this specific lot
        buy.quantity - COALESCE(
            (SELECT SUM(sell.quantity) 
             FROM transactions sell 
             WHERE sell.type = 'SELL' 
             AND sell.source_transaction_id = buy.id),
            0
        ) AS remaining_shares
    FROM transactions buy
    WHERE buy.type = 'BUY'
),
-- Calculate unallocated sells (old sells without source_transaction_id)
-- These are distributed FIFO across lots
unallocated_sells AS (
    SELECT 
        t.portfolio_id,
        t.stock_id,
        SUM(t.quantity) AS unallocated_sold
    FROM transactions t
    WHERE t.type = 'SELL' 
    AND t.source_transaction_id IS NULL
    GROUP BY t.portfolio_id, t.stock_id
),
-- Apply FIFO to unallocated sells
lot_after_fifo AS (
    SELECT 
        lr.lot_id,
        lr.portfolio_id,
        lr.stock_id,
        lr.buy_date,
        lr.original_quantity,
        lr.price_per_share,
        lr.currency,
        lr.total_amount_czk,
        lr.exchange_rate_to_czk,
        lr.remaining_shares,
        -- Running total of remaining shares before this lot (for FIFO calculation)
        COALESCE(SUM(lr.remaining_shares) OVER (
            PARTITION BY lr.portfolio_id, lr.stock_id 
            ORDER BY lr.buy_date, lr.lot_id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0) AS shares_before_this_lot,
        COALESCE(us.unallocated_sold, 0) AS unallocated_sold
    FROM lot_remaining lr
    LEFT JOIN unallocated_sells us 
        ON lr.portfolio_id = us.portfolio_id 
        AND lr.stock_id = us.stock_id
),
-- Calculate final remaining shares per lot after FIFO
lot_final AS (
    SELECT 
        lot_id,
        portfolio_id,
        stock_id,
        buy_date,
        original_quantity,
        price_per_share,
        currency,
        total_amount_czk,
        exchange_rate_to_czk,
        remaining_shares,
        -- Apply FIFO: subtract unallocated sells from oldest lots first
        GREATEST(0, 
            remaining_shares - GREATEST(0, unallocated_sold - shares_before_this_lot)
        ) AS final_remaining_shares
    FROM lot_after_fifo
),
-- Aggregate by stock
stock_summary AS (
    SELECT 
        lf.portfolio_id,
        lf.stock_id,
        s.ticker,
        s.name AS stock_name,
        s.currency,
        s.exchange,
        s.target_price,
        sec.name AS sector_name,
        
        -- Total remaining shares
        SUM(lf.final_remaining_shares) AS total_shares,
        
        -- Weighted average buy price of remaining shares (in original currency)
        CASE 
            WHEN SUM(lf.final_remaining_shares) > 0 THEN
                SUM(lf.final_remaining_shares * lf.price_per_share) / SUM(lf.final_remaining_shares)
            ELSE 0
        END AS avg_buy_price,
        
        -- Total invested in CZK = for each lot: (remaining_shares / original_quantity) * original_total_czk
        -- This correctly handles partial sells and uses the actual CZK amount from the transaction
        SUM(
            CASE 
                WHEN lf.original_quantity > 0 THEN
                    (lf.final_remaining_shares / lf.original_quantity) * lf.total_amount_czk
                ELSE 0
            END
        ) AS total_invested_czk,
        
        -- Keep track of original totals for reference
        SUM(lf.original_quantity) AS total_buy_shares,
        
        -- Fees (all fees, not just remaining - this is debatable)
        (SELECT SUM(fees) FROM transactions t2 
         WHERE t2.portfolio_id = lf.portfolio_id 
         AND t2.stock_id = lf.stock_id) AS total_fees,
        (SELECT SUM(fees_czk) FROM transactions t2 
         WHERE t2.portfolio_id = lf.portfolio_id 
         AND t2.stock_id = lf.stock_id) AS total_fees_czk,
        
        -- Dates
        MIN(lf.buy_date) AS first_purchase,
        MAX(lf.buy_date) AS last_purchase,
        
        -- Counts
        COUNT(DISTINCT CASE WHEN lf.final_remaining_shares > 0 THEN lf.lot_id END) AS purchase_count,
        (SELECT COUNT(*) FROM transactions t2 
         WHERE t2.portfolio_id = lf.portfolio_id 
         AND t2.stock_id = lf.stock_id 
         AND t2.type = 'SELL') AS sell_count
        
    FROM lot_final lf
    JOIN stocks s ON lf.stock_id = s.id
    LEFT JOIN sectors sec ON s.sector_id = sec.id
    GROUP BY lf.portfolio_id, lf.stock_id, s.ticker, s.name, s.currency, s.exchange, s.target_price, sec.name
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
    avg_buy_price,
    total_invested_czk,
    total_fees,
    total_fees_czk,
    first_purchase,
    last_purchase,
    purchase_count,
    sell_count,
    0 AS realized_gains -- We don't track this, placeholder for compatibility
FROM stock_summary
WHERE total_shares > 0;

-- Recreate portfolio_summary view with security_invoker
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
    -- Profit/Loss (comparing current value to invested value in CZK)
    ((h.total_shares * cp.price * COALESCE(cp.exchange_rate_to_czk, 1)) - h.total_invested_czk) AS unrealized_gain,
    -- Percentage gain
    CASE 
        WHEN h.total_invested_czk > 0 THEN 
            (((h.total_shares * cp.price * COALESCE(cp.exchange_rate_to_czk, 1)) - h.total_invested_czk) / h.total_invested_czk * 100)
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

-- Add comment
COMMENT ON VIEW holdings IS 'Calculates current holdings with correct avg_buy_price and invested amount based on remaining lots after sales. Supports both lot-specific sells (source_transaction_id) and legacy FIFO sells (NULL source).';
