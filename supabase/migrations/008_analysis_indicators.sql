-- Analysis Indicators System
-- Stores all available indicators with metadata for tooltips, formatting, and thresholds

-- Main indicators catalog
CREATE TABLE IF NOT EXISTS analysis_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'peRatio', 'roe', 'beta'
    name VARCHAR(100) NOT NULL,        -- Display name: 'P/E Ratio'
    short_name VARCHAR(20) NOT NULL,   -- Column header: 'P/E'
    description TEXT NOT NULL,         -- Tooltip explanation
    category VARCHAR(50) NOT NULL,     -- 'valuation', 'profitability', 'growth', 'risk', 'dividend', 'performance'
    data_type VARCHAR(20) NOT NULL DEFAULT 'number', -- 'number', 'percent', 'currency', 'ratio'
    format_decimals INTEGER DEFAULT 2,
    format_prefix VARCHAR(10) DEFAULT '',   -- e.g., '$' for currency
    format_suffix VARCHAR(10) DEFAULT '',   -- e.g., '%' for percent
    good_threshold DECIMAL,            -- Value above/below which is "good" (green)
    bad_threshold DECIMAL,             -- Value above/below which is "bad" (red)
    higher_is_better BOOLEAN DEFAULT true,  -- true = higher values are good
    source VARCHAR(20) DEFAULT 'finnhub',   -- 'finnhub', 'yahoo', 'calculated'
    source_key VARCHAR(100),           -- The actual API field name (e.g., 'peTTM')
    is_premium BOOLEAN DEFAULT false,  -- Requires premium API
    sort_order INTEGER DEFAULT 100,    -- Default ordering within category
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User custom views (which columns they want to see)
CREATE TABLE IF NOT EXISTS user_analysis_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    indicator_keys TEXT[] NOT NULL,    -- Array of indicator keys in order
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one default view per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_default_view 
    ON user_analysis_views(user_id) 
    WHERE is_default = true;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_indicators_category ON analysis_indicators(category);
CREATE INDEX IF NOT EXISTS idx_user_views_user ON user_analysis_views(user_id);

-- Enable RLS
ALTER TABLE analysis_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_analysis_views ENABLE ROW LEVEL SECURITY;

-- Indicators are readable by everyone (public catalog)
CREATE POLICY "Indicators are viewable by authenticated users" 
    ON analysis_indicators FOR SELECT 
    TO authenticated 
    USING (true);

-- Users can only see/manage their own views
CREATE POLICY "Users can view their own analysis views" 
    ON user_analysis_views FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analysis views" 
    ON user_analysis_views FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analysis views" 
    ON user_analysis_views FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analysis views" 
    ON user_analysis_views FOR DELETE 
    TO authenticated 
    USING (auth.uid() = user_id);

-- =====================================================
-- SEED DATA: All available indicators from Finnhub FREE
-- =====================================================

INSERT INTO analysis_indicators (key, name, short_name, description, category, data_type, format_decimals, format_suffix, good_threshold, bad_threshold, higher_is_better, source_key, sort_order) VALUES

-- VALUATION METRICS
('peRatio', 'Price to Earnings Ratio', 'P/E', 
 'Stock price divided by earnings per share. Lower P/E may indicate undervaluation. Compare within same industry.',
 'valuation', 'number', 1, '', 15, 30, false, 'peBasicExclExtraTTM', 10),

('pbRatio', 'Price to Book Ratio', 'P/B', 
 'Stock price divided by book value per share. P/B < 1 may indicate undervaluation or financial trouble.',
 'valuation', 'number', 1, '', 1, 3, false, 'pbQuarterly', 20),

('psRatio', 'Price to Sales Ratio', 'P/S', 
 'Market cap divided by revenue. Useful for comparing companies without profits.',
 'valuation', 'number', 1, '', 2, 5, false, 'psTTM', 30),

('pegRatio', 'PEG Ratio', 'PEG', 
 'P/E divided by earnings growth rate. PEG < 1 may indicate undervaluation relative to growth.',
 'valuation', 'number', 2, '', 1, 2, false, 'pegTTM', 40),

('evEbitda', 'EV/EBITDA', 'EV/EBITDA', 
 'Enterprise value divided by EBITDA. Lower values may indicate better value. Useful for comparing across capital structures.',
 'valuation', 'number', 1, '', 10, 20, false, 'evEbitdaTTM', 50),

('forwardPe', 'Forward P/E', 'Fwd P/E', 
 'Stock price divided by estimated future earnings. Compare to trailing P/E to see growth expectations.',
 'valuation', 'number', 1, '', 15, 30, false, 'forwardPE', 60),

-- PROFITABILITY METRICS
('roe', 'Return on Equity', 'ROE', 
 'Net income as percentage of shareholder equity. Measures how efficiently company uses equity to generate profits.',
 'profitability', 'percent', 1, '%', 15, 5, true, 'roeTTM', 10),

('roa', 'Return on Assets', 'ROA', 
 'Net income as percentage of total assets. Shows how efficiently company uses assets to generate profits.',
 'profitability', 'percent', 1, '%', 10, 3, true, 'roaTTM', 20),

('roi', 'Return on Investment', 'ROI', 
 'Return generated on invested capital. Higher ROI indicates more efficient use of capital.',
 'profitability', 'percent', 1, '%', 15, 5, true, 'roiTTM', 30),

('grossMargin', 'Gross Margin', 'Gross', 
 'Gross profit as percentage of revenue. Shows pricing power and production efficiency.',
 'profitability', 'percent', 1, '%', 40, 20, true, 'grossMarginTTM', 40),

('operatingMargin', 'Operating Margin', 'Op Margin', 
 'Operating income as percentage of revenue. Shows operational efficiency before interest and taxes.',
 'profitability', 'percent', 1, '%', 20, 10, true, 'operatingMarginTTM', 50),

('netMargin', 'Net Profit Margin', 'Net Margin', 
 'Net income as percentage of revenue. Shows overall profitability after all expenses.',
 'profitability', 'percent', 1, '%', 15, 5, true, 'netProfitMarginTTM', 60),

-- GROWTH METRICS
('revenueGrowth', 'Revenue Growth (YoY)', 'Rev Growth', 
 'Year-over-year revenue growth rate. Positive growth indicates expanding business.',
 'growth', 'percent', 1, '%', 10, 0, true, 'revenueGrowthQuarterlyYoy', 10),

('epsGrowth', 'EPS Growth (YoY)', 'EPS Growth', 
 'Year-over-year earnings per share growth. Shows earnings momentum.',
 'growth', 'percent', 1, '%', 15, 0, true, 'epsGrowthQuarterlyYoy', 20),

('revenueGrowth3Y', 'Revenue Growth (3Y CAGR)', 'Rev 3Y', 
 '3-year compound annual growth rate of revenue. Shows medium-term growth trend.',
 'growth', 'percent', 1, '%', 10, 0, true, 'revenueGrowth3Y', 30),

('revenueGrowth5Y', 'Revenue Growth (5Y CAGR)', 'Rev 5Y', 
 '5-year compound annual growth rate of revenue. Shows long-term growth trend.',
 'growth', 'percent', 1, '%', 10, 0, true, 'revenueGrowth5Y', 40),

('epsGrowth5Y', 'EPS Growth (5Y CAGR)', 'EPS 5Y', 
 '5-year compound annual growth rate of EPS. Shows long-term earnings growth.',
 'growth', 'percent', 1, '%', 10, 0, true, 'epsGrowth5Y', 50),

-- RISK METRICS
('beta', 'Beta', 'Beta', 
 'Stock volatility relative to market. Beta > 1 = more volatile than market, < 1 = less volatile.',
 'risk', 'number', 2, '', 0.8, 1.3, false, 'beta', 10),

('debtToEquity', 'Debt to Equity', 'D/E', 
 'Total debt divided by shareholder equity. Higher values indicate more leverage/risk.',
 'risk', 'number', 1, '', 50, 100, false, 'totalDebt/totalEquityQuarterly', 20),

('currentRatio', 'Current Ratio', 'Current', 
 'Current assets divided by current liabilities. > 1 means company can cover short-term obligations.',
 'risk', 'number', 2, '', 1.5, 1, true, 'currentRatioQuarterly', 30),

('quickRatio', 'Quick Ratio', 'Quick', 
 'Liquid assets divided by current liabilities. Stricter liquidity test than current ratio.',
 'risk', 'number', 2, '', 1, 0.5, true, 'quickRatioQuarterly', 40),

-- DIVIDEND METRICS
('dividendYield', 'Dividend Yield', 'Div Yield', 
 'Annual dividend per share divided by stock price. Shows income return on investment.',
 'dividend', 'percent', 2, '%', 2, 0, true, 'dividendYieldIndicatedAnnual', 10),

('payoutRatio', 'Payout Ratio', 'Payout', 
 'Percentage of earnings paid as dividends. High payout may limit growth investment.',
 'dividend', 'percent', 1, '%', 50, 80, false, 'payoutRatioTTM', 20),

('dividendGrowth5Y', 'Dividend Growth (5Y)', 'Div Growth', 
 '5-year compound annual growth rate of dividends. Shows dividend growth trend.',
 'dividend', 'percent', 1, '%', 5, 0, true, 'dividendGrowthRate5Y', 30),

-- PERFORMANCE METRICS
('return52W', '52-Week Return', '52W Return', 
 'Stock price return over the past 52 weeks.',
 'performance', 'percent', 1, '%', 15, 0, true, '52WeekPriceReturnDaily', 10),

('return13W', '13-Week Return', '13W Return', 
 'Stock price return over the past 13 weeks (quarter).',
 'performance', 'percent', 1, '%', 5, -5, true, '13WeekPriceReturnDaily', 20),

('returnVsSP500', 'Return vs S&P 500 (52W)', 'vs S&P', 
 'Stock return relative to S&P 500 over 52 weeks. Positive = outperforming market.',
 'performance', 'percent', 1, '%', 5, -5, true, 'priceRelativeToS&P50052Week', 30),

-- SIZE METRICS  
('marketCap', 'Market Capitalization', 'Mkt Cap', 
 'Total market value of outstanding shares. Large cap > $10B, Mid cap $2-10B, Small cap < $2B.',
 'size', 'currency', 0, '', NULL, NULL, true, 'marketCapitalization', 10),

('enterpriseValue', 'Enterprise Value', 'EV', 
 'Market cap + debt - cash. Represents total company value for acquisition purposes.',
 'size', 'currency', 0, '', NULL, NULL, true, 'enterpriseValue', 20)

ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    good_threshold = EXCLUDED.good_threshold,
    bad_threshold = EXCLUDED.bad_threshold,
    higher_is_better = EXCLUDED.higher_is_better,
    source_key = EXCLUDED.source_key;

-- Create a default view template (will be copied for new users)
-- This can be used as reference for the frontend
COMMENT ON TABLE analysis_indicators IS 'Catalog of all available analysis indicators with metadata for display and thresholds';
COMMENT ON TABLE user_analysis_views IS 'User-customizable column configurations for analysis tables';
