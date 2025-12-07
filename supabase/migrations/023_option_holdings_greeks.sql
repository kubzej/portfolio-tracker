-- Migration: Add missing Greeks to option_holdings view
-- This adds gamma, theta, vega columns from option_prices

-- Drop and recreate the view with all Greeks
DROP VIEW IF EXISTS option_holdings;

CREATE VIEW option_holdings
WITH (security_invoker = true) AS
WITH option_summary AS (
    SELECT 
        ot.portfolio_id,
        ot.symbol,
        ot.option_symbol,
        ot.option_type,
        ot.strike_price,
        ot.expiration_date,
        
        -- Určení pozice (Long vs Short)
        -- BTO/EXERCISE vytváří Long, STO vytváří Short
        CASE 
            WHEN SUM(
                CASE 
                    WHEN ot.action IN ('BTO', 'EXERCISE') THEN ot.contracts
                    WHEN ot.action IN ('STC', 'EXPIRATION', 'ASSIGNMENT') THEN -ot.contracts
                    ELSE 0
                END
            ) > 0 THEN 'long'
            WHEN SUM(
                CASE 
                    WHEN ot.action IN ('STO') THEN ot.contracts
                    WHEN ot.action IN ('BTC', 'EXPIRATION', 'ASSIGNMENT') THEN -ot.contracts
                    ELSE 0
                END
            ) > 0 THEN 'short'
            ELSE NULL
        END AS position,
        
        -- Long contracts count
        SUM(
            CASE 
                WHEN ot.action IN ('BTO', 'EXERCISE') THEN ot.contracts
                WHEN ot.action IN ('STC', 'EXPIRATION', 'ASSIGNMENT') AND 
                     EXISTS (SELECT 1 FROM option_transactions ot2 
                             WHERE ot2.option_symbol = ot.option_symbol 
                             AND ot2.portfolio_id = ot.portfolio_id
                             AND ot2.action IN ('BTO', 'EXERCISE')) THEN -ot.contracts
                ELSE 0
            END
        ) AS long_contracts,
        
        -- Short contracts count
        SUM(
            CASE 
                WHEN ot.action = 'STO' THEN ot.contracts
                WHEN ot.action IN ('BTC', 'EXPIRATION', 'ASSIGNMENT') AND
                     EXISTS (SELECT 1 FROM option_transactions ot2 
                             WHERE ot2.option_symbol = ot.option_symbol 
                             AND ot2.portfolio_id = ot.portfolio_id
                             AND ot2.action = 'STO') THEN -ot.contracts
                ELSE 0
            END
        ) AS short_contracts,
        
        -- Průměrná cena pro Long pozice (BTO)
        CASE 
            WHEN SUM(CASE WHEN ot.action = 'BTO' THEN ot.contracts ELSE 0 END) > 0 THEN
                SUM(CASE WHEN ot.action = 'BTO' THEN ot.contracts * ot.premium ELSE 0 END) /
                NULLIF(SUM(CASE WHEN ot.action = 'BTO' THEN ot.contracts ELSE 0 END), 0)
            ELSE NULL
        END AS avg_premium_long,
        
        -- Průměrná cena pro Short pozice (STO)
        CASE 
            WHEN SUM(CASE WHEN ot.action = 'STO' THEN ot.contracts ELSE 0 END) > 0 THEN
                SUM(CASE WHEN ot.action = 'STO' THEN ot.contracts * ot.premium ELSE 0 END) /
                NULLIF(SUM(CASE WHEN ot.action = 'STO' THEN ot.contracts ELSE 0 END), 0)
            ELSE NULL
        END AS avg_premium_short,
        
        -- Celkové náklady/příjmy
        SUM(
            CASE 
                WHEN ot.action IN ('BTO', 'BTC') THEN -ot.total_premium  -- Platím
                WHEN ot.action IN ('STO', 'STC') THEN ot.total_premium   -- Inkasuju
                ELSE 0
            END
        ) AS total_premium_flow,
        
        -- Celkové poplatky
        SUM(COALESCE(ot.fees, 0)) AS total_fees,
        
        -- První a poslední transakce
        MIN(ot.date) AS first_transaction,
        MAX(ot.date) AS last_transaction
        
    FROM option_transactions ot
    GROUP BY 
        ot.portfolio_id,
        ot.symbol,
        ot.option_symbol,
        ot.option_type,
        ot.strike_price,
        ot.expiration_date
)
SELECT 
    os.portfolio_id,
    os.symbol,
    os.option_symbol,
    os.option_type,
    os.strike_price,
    os.expiration_date,
    os.position,
    -- Aktuální počet kontraktů
    CASE 
        WHEN os.position = 'long' THEN os.long_contracts
        WHEN os.position = 'short' THEN os.short_contracts
        ELSE 0
    END AS contracts,
    -- Průměrná cena
    CASE 
        WHEN os.position = 'long' THEN os.avg_premium_long
        WHEN os.position = 'short' THEN os.avg_premium_short
        ELSE NULL
    END AS avg_premium,
    -- Celková hodnota pozice (cost basis)
    CASE 
        WHEN os.position = 'long' THEN os.long_contracts * 100 * COALESCE(os.avg_premium_long, 0)
        WHEN os.position = 'short' THEN os.short_contracts * 100 * COALESCE(os.avg_premium_short, 0)
        ELSE 0
    END AS total_cost,
    os.total_fees,
    os.first_transaction,
    os.last_transaction,
    -- Days to Expiration
    os.expiration_date - CURRENT_DATE AS dte,
    -- Aktuální cena a Greeks z cache
    op.price AS current_price,
    op.bid,
    op.ask,
    op.implied_volatility,
    op.delta,
    op.gamma,
    op.theta,
    op.vega,
    op.updated_at AS price_updated_at
FROM option_summary os
LEFT JOIN option_prices op ON os.option_symbol = op.option_symbol
WHERE 
    -- Zobrazit pouze otevřené pozice
    (os.position = 'long' AND os.long_contracts > 0) OR
    (os.position = 'short' AND os.short_contracts > 0);
