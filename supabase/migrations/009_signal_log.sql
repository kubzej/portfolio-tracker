-- =====================================================
-- Signal Log Table for tracking recommendation signals
-- Used to evaluate signal quality over time
-- =====================================================

-- Signal log table
CREATE TABLE IF NOT EXISTS signal_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Identifikace
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    stock_name VARCHAR(255),
    
    -- Signál
    signal_type VARCHAR(50) NOT NULL,  -- 'DIP_OPPORTUNITY', 'MOMENTUM', 'CONVICTION_HOLD', etc.
    signal_strength DECIMAL(5, 2),      -- 0-100
    
    -- Scores at signal time
    composite_score DECIMAL(5, 2),
    fundamental_score DECIMAL(5, 2),
    technical_score DECIMAL(5, 2),
    analyst_score DECIMAL(5, 2),
    news_score DECIMAL(5, 2),
    conviction_score DECIMAL(5, 2),
    dip_score DECIMAL(5, 2),
    
    -- Cena při signálu
    price_at_signal DECIMAL(15, 4) NOT NULL,
    
    -- Ceny po X dnech (vyplňuje cron job)
    price_1d DECIMAL(15, 4),
    price_1w DECIMAL(15, 4),
    price_1m DECIMAL(15, 4),
    price_3m DECIMAL(15, 4),
    
    -- Timestamps pro vyhodnocení
    evaluated_1d_at TIMESTAMPTZ,
    evaluated_1w_at TIMESTAMPTZ,
    evaluated_1m_at TIMESTAMPTZ,
    evaluated_3m_at TIMESTAMPTZ,
    
    -- Technické indikátory při signálu
    rsi_value DECIMAL(5, 2),
    macd_histogram DECIMAL(10, 4),
    
    -- Dodatečná metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexy pro rychlé dotazy
CREATE INDEX idx_signal_log_portfolio ON signal_log(portfolio_id);
CREATE INDEX idx_signal_log_ticker ON signal_log(ticker);
CREATE INDEX idx_signal_log_type ON signal_log(signal_type);
CREATE INDEX idx_signal_log_created ON signal_log(created_at DESC);

-- Index pro deduplikaci (najít existující signály)
CREATE INDEX idx_signal_log_dedup ON signal_log(portfolio_id, ticker, signal_type, created_at DESC);

-- Indexy pro cron job - jednoduchý index na created_at, filtrování v dotazu
CREATE INDEX idx_signal_log_pending ON signal_log(created_at) 
    WHERE price_1d IS NULL OR price_1w IS NULL OR price_1m IS NULL OR price_3m IS NULL;

-- RLS policies
ALTER TABLE signal_log ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view signals (single-user app)
CREATE POLICY "Authenticated users can view signals" ON signal_log
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Authenticated users can insert signals" ON signal_log
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Authenticated users can delete signals" ON signal_log
    FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Service role can do everything (for cron job)
CREATE POLICY "Service role full access" ON signal_log
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- Helper function to check for duplicate signals
-- Returns true if a similar signal exists in last N days
-- =====================================================
CREATE OR REPLACE FUNCTION signal_exists(
    p_portfolio_id UUID,
    p_ticker VARCHAR,
    p_signal_type VARCHAR,
    p_days_window INTEGER DEFAULT 7
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM signal_log
        WHERE portfolio_id = p_portfolio_id
          AND ticker = p_ticker
          AND signal_type = p_signal_type
          AND created_at > NOW() - (p_days_window || ' days')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- View for signal performance statistics
-- =====================================================
CREATE OR REPLACE VIEW signal_performance AS
SELECT 
    portfolio_id,
    signal_type,
    COUNT(*) as total_signals,
    
    -- 1-day performance
    COUNT(*) FILTER (WHERE price_1d IS NOT NULL) as evaluated_1d,
    COUNT(*) FILTER (WHERE price_1d > price_at_signal) as winners_1d,
    ROUND(
        AVG((price_1d - price_at_signal) / price_at_signal * 100) 
        FILTER (WHERE price_1d IS NOT NULL), 2
    ) as avg_return_1d,
    
    -- 1-week performance
    COUNT(*) FILTER (WHERE price_1w IS NOT NULL) as evaluated_1w,
    COUNT(*) FILTER (WHERE price_1w > price_at_signal) as winners_1w,
    ROUND(
        AVG((price_1w - price_at_signal) / price_at_signal * 100) 
        FILTER (WHERE price_1w IS NOT NULL), 2
    ) as avg_return_1w,
    
    -- 1-month performance
    COUNT(*) FILTER (WHERE price_1m IS NOT NULL) as evaluated_1m,
    COUNT(*) FILTER (WHERE price_1m > price_at_signal) as winners_1m,
    ROUND(
        AVG((price_1m - price_at_signal) / price_at_signal * 100) 
        FILTER (WHERE price_1m IS NOT NULL), 2
    ) as avg_return_1m,
    
    -- Average scores
    ROUND(AVG(composite_score), 1) as avg_composite_score,
    ROUND(AVG(signal_strength), 1) as avg_signal_strength

FROM signal_log
GROUP BY portfolio_id, signal_type;
