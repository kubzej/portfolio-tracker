-- =====================================================
-- Watchlists & Watchlist Items
-- Pro sledování akcií mimo portfolio
-- =====================================================

-- 1. WATCHLISTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#94a3b8', -- hex color for UI (same as portfolios)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WATCHLIST ITEMS TABLE
-- =====================================================
-- Položky watchlistu - akcie ke sledování
-- Neodkazuje na stocks tabulku - ticker je nezávislý
CREATE TABLE IF NOT EXISTS watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    
    -- Identifikace akcie
    ticker VARCHAR(20) NOT NULL,
    name VARCHAR(255), -- cache názvu akcie (z Yahoo/Finnhub)
    finnhub_ticker VARCHAR(20), -- pro non-US akcie (např. ASML.AS → ASML)
    
    -- Osobní nastavení (neovlivňují analýzy)
    target_buy_price DECIMAL(15, 4), -- moje cílová nákupní cena
    target_sell_price DECIMAL(15, 4), -- moje cílová prodejní cena
    notes TEXT, -- osobní poznámky
    
    -- Cache posledních dat (pro rychlé zobrazení bez API call)
    last_price DECIMAL(15, 4),
    last_price_change DECIMAL(15, 4),
    last_price_change_percent DECIMAL(8, 4),
    last_price_updated_at TIMESTAMPTZ,
    
    -- Metadata
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unikátní kombinace watchlist + ticker
    UNIQUE(watchlist_id, ticker)
);

-- 3. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_ticker ON watchlist_items(ticker);

-- 4. TRIGGERS
-- =====================================================

-- Auto-update updated_at na watchlists
CREATE OR REPLACE FUNCTION update_watchlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_watchlist_updated_at ON watchlists;
CREATE TRIGGER trigger_watchlist_updated_at
    BEFORE UPDATE ON watchlists
    FOR EACH ROW
    EXECUTE FUNCTION update_watchlist_timestamp();

-- Auto-update updated_at na watchlist_items
DROP TRIGGER IF EXISTS trigger_watchlist_item_updated_at ON watchlist_items;
CREATE TRIGGER trigger_watchlist_item_updated_at
    BEFORE UPDATE ON watchlist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_watchlist_timestamp();

-- 5. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

-- Allow all for single-user app (same as portfolios)
CREATE POLICY "Allow all for watchlists" ON watchlists 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for watchlist_items" ON watchlist_items 
    FOR ALL USING (true) WITH CHECK (true);

-- 6. VIEW: Watchlist Summary
-- =====================================================
-- Rychlý přehled watchlistů s počtem položek
CREATE OR REPLACE VIEW watchlist_summary AS
SELECT 
    w.id,
    w.name,
    w.description,
    w.color,
    w.created_at,
    w.updated_at,
    COUNT(wi.id) AS item_count,
    -- Agregace položek
    COUNT(wi.id) FILTER (
        WHERE wi.last_price IS NOT NULL 
        AND wi.target_buy_price IS NOT NULL 
        AND wi.last_price <= wi.target_buy_price
    ) AS items_at_buy_target,
    COUNT(wi.id) FILTER (
        WHERE wi.last_price IS NOT NULL 
        AND wi.target_sell_price IS NOT NULL 
        AND wi.last_price >= wi.target_sell_price
    ) AS items_at_sell_target
FROM watchlists w
LEFT JOIN watchlist_items wi ON w.id = wi.watchlist_id
GROUP BY w.id, w.name, w.description, w.color, w.created_at, w.updated_at;

-- =====================================================
-- DONE: Watchlists schema ready
-- =====================================================
