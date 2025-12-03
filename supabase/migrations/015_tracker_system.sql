-- =====================================================
-- Migration: Tracker System
-- =====================================================
-- Komplexní systém pro sledování portfolia a research:
-- 1. Denní snapshoty portfolia a research
-- 2. Research tracking (sledované akcie z research)
-- 3. Rozšířený signal_log o source
-- =====================================================

-- Cleanup pokud migrace částečně proběhla
DROP VIEW IF EXISTS public.research_tracked_summary;
DROP VIEW IF EXISTS public.snapshot_changes;
DROP VIEW IF EXISTS public.latest_snapshots;
DROP FUNCTION IF EXISTS public.detect_snapshot_changes() CASCADE;
DROP FUNCTION IF EXISTS public.get_previous_snapshot(UUID, VARCHAR, VARCHAR, DATE);
DROP TABLE IF EXISTS public.research_tracked;
DROP TABLE IF EXISTS public.snapshot_holdings;
DROP TABLE IF EXISTS public.daily_snapshots;

-- =====================================================
-- 1. DAILY SNAPSHOTS (denní souhrn)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Portfolio summary
  portfolio_total_value DECIMAL(15,2),
  portfolio_total_value_czk DECIMAL(15,2),
  portfolio_total_gain DECIMAL(15,2),
  portfolio_total_gain_pct DECIMAL(8,2),
  portfolio_positions_count INT DEFAULT 0,
  
  -- Research summary
  research_tracked_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, snapshot_date)
);

-- Index pro rychlé dotazy
CREATE INDEX idx_daily_snapshots_user_date 
  ON daily_snapshots(user_id, snapshot_date DESC);

-- =====================================================
-- 2. SNAPSHOT HOLDINGS (detail jednotlivých pozic)
-- =====================================================
CREATE TABLE IF NOT EXISTS snapshot_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES daily_snapshots(id) ON DELETE CASCADE,
  
  -- Identifikace
  ticker VARCHAR(20) NOT NULL,
  stock_name VARCHAR(255),
  source VARCHAR(20) NOT NULL CHECK (source IN ('portfolio', 'research')),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  
  -- Pozice (pro portfolio, NULL pro research)
  shares DECIMAL(15,6),
  avg_price DECIMAL(15,4),
  weight DECIMAL(8,2),
  unrealized_gain DECIMAL(15,2),
  unrealized_gain_pct DECIMAL(8,2),
  
  -- Aktuální cena
  current_price DECIMAL(15,4),
  current_value DECIMAL(15,2),
  
  -- Skóre (0-100, s desetinnými místy)
  composite_score NUMERIC(5,2),
  conviction_score NUMERIC(5,2),
  conviction_level VARCHAR(10), -- LOW, MEDIUM, HIGH
  fundamental_score NUMERIC(5,2),
  technical_score NUMERIC(5,2),
  analyst_score NUMERIC(5,2),
  news_score NUMERIC(5,2),
  insider_score NUMERIC(5,2),
  dip_score NUMERIC(5,2),
  
  -- Technické indikátory
  rsi DECIMAL(8,2),
  macd_histogram DECIMAL(15,6),
  adx DECIMAL(8,2),
  
  -- Signály
  primary_signal VARCHAR(30),
  quality_signal VARCHAR(30),
  
  -- Change detection flags
  signal_changed BOOLEAN DEFAULT FALSE,    -- signál se změnil od včerejška
  conviction_changed BOOLEAN DEFAULT FALSE, -- conviction level se změnil
  score_changed BOOLEAN DEFAULT FALSE,      -- composite score změna > 5
  price_changed BOOLEAN DEFAULT FALSE,      -- cena změna > 3%
  
  -- Pro research tracking
  tracked_since DATE,          -- kdy přidáno do research tracking
  price_at_tracking DECIMAL(15,4), -- cena při přidání do tracking
  gain_since_tracking_pct DECIMAL(8,2), -- změna od přidání
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexy pro rychlé dotazy
CREATE INDEX idx_snapshot_holdings_snapshot 
  ON snapshot_holdings(snapshot_id);
CREATE INDEX idx_snapshot_holdings_ticker 
  ON snapshot_holdings(ticker);
CREATE INDEX idx_snapshot_holdings_source 
  ON snapshot_holdings(source);
CREATE INDEX idx_snapshot_holdings_signal_changed 
  ON snapshot_holdings(signal_changed) WHERE signal_changed = TRUE;

-- =====================================================
-- 3. RESEARCH TRACKED (sledované akcie z research)
-- =====================================================
CREATE TABLE IF NOT EXISTS research_tracked (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stock info
  ticker VARCHAR(20) NOT NULL,
  stock_name VARCHAR(255),
  finnhub_ticker VARCHAR(20),
  
  -- Tracking info
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_price DECIMAL(15,4),
  added_signal VARCHAR(30),          -- signál při přidání
  added_composite_score INT,
  added_conviction_level VARCHAR(10),
  
  -- Current state (updated by cron)
  current_price DECIMAL(15,4),
  current_signal VARCHAR(30),
  price_change_pct DECIMAL(8,2),     -- změna od přidání
  last_updated TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'bought', 'dismissed')),
  notes TEXT,
  
  -- When bought/dismissed
  status_changed_at TIMESTAMPTZ,
  bought_price DECIMAL(15,4),        -- pokud status = 'bought'
  
  UNIQUE(user_id, ticker)
);

-- Index
CREATE INDEX idx_research_tracked_user_status 
  ON research_tracked(user_id, status);

-- =====================================================
-- 4. ROZŠÍŘENÍ SIGNAL_LOG O SOURCE
-- =====================================================
-- Přidáme sloupec pro rozlišení portfolio vs research signálů
ALTER TABLE signal_log 
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'portfolio' 
  CHECK (source IN ('portfolio', 'research'));

-- Pro research signály nepotřebujeme portfolio_id - změníme na nullable
-- (pouze pokud je tabulka prázdná nebo povolíme NULL)
ALTER TABLE signal_log 
  ALTER COLUMN portfolio_id DROP NOT NULL;

-- Přidáme user_id pro research signály (portfolio signály mají portfolio_id)
ALTER TABLE signal_log 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index pro filtrování podle source
CREATE INDEX IF NOT EXISTS idx_signal_log_source 
  ON signal_log(source);

-- Index pro user_id (pro research)
CREATE INDEX IF NOT EXISTS idx_signal_log_user 
  ON signal_log(user_id);

-- Constraint: buď portfolio_id nebo user_id musí být vyplněno
-- (nemůžeme přidat CHECK constraint na existující tabulku jednoduše, 
-- validaci uděláme v aplikaci)

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

-- Daily snapshots
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON daily_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own snapshots" ON daily_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access snapshots" ON daily_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- Snapshot holdings
ALTER TABLE snapshot_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshot holdings" ON snapshot_holdings
  FOR SELECT USING (
    snapshot_id IN (
      SELECT id FROM daily_snapshots WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access holdings" ON snapshot_holdings
  FOR ALL USING (auth.role() = 'service_role');

-- Research tracked
ALTER TABLE research_tracked ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own research tracked" ON research_tracked
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Funkce pro získání posledního snapshotu pro ticker
CREATE OR REPLACE FUNCTION public.get_previous_snapshot(
  p_user_id UUID,
  p_ticker VARCHAR,
  p_source VARCHAR,
  p_before_date DATE
) RETURNS public.snapshot_holdings AS $$
  SELECT sh.*
  FROM public.snapshot_holdings sh
  JOIN public.daily_snapshots ds ON sh.snapshot_id = ds.id
  WHERE ds.user_id = p_user_id
    AND sh.ticker = p_ticker
    AND sh.source = p_source
    AND ds.snapshot_date < p_before_date
  ORDER BY ds.snapshot_date DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE
SET search_path = '';

-- Funkce pro detekci změn
CREATE OR REPLACE FUNCTION public.detect_snapshot_changes()
RETURNS TRIGGER AS $$
DECLARE
  prev public.snapshot_holdings;
BEGIN
  -- Získej předchozí snapshot
  SELECT * INTO prev FROM public.get_previous_snapshot(
    (SELECT user_id FROM public.daily_snapshots WHERE id = NEW.snapshot_id),
    NEW.ticker,
    NEW.source,
    (SELECT snapshot_date FROM public.daily_snapshots WHERE id = NEW.snapshot_id)
  );
  
  IF prev IS NOT NULL THEN
    -- Signal changed
    NEW.signal_changed := (NEW.primary_signal IS DISTINCT FROM prev.primary_signal);
    
    -- Conviction changed
    NEW.conviction_changed := (NEW.conviction_level IS DISTINCT FROM prev.conviction_level);
    
    -- Score changed (> 5 bodů)
    NEW.score_changed := (
      NEW.composite_score IS NOT NULL AND 
      prev.composite_score IS NOT NULL AND
      ABS(NEW.composite_score - prev.composite_score) > 5
    );
    
    -- Price changed (> 3%)
    NEW.price_changed := (
      NEW.current_price IS NOT NULL AND 
      prev.current_price IS NOT NULL AND
      prev.current_price > 0 AND
      ABS((NEW.current_price - prev.current_price) / prev.current_price * 100) > 3
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE TRIGGER trigger_detect_snapshot_changes
  BEFORE INSERT ON snapshot_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_snapshot_changes();

-- =====================================================
-- 7. VIEWS PRO SNADNÉ DOTAZY
-- =====================================================

-- View: Poslední snapshot pro každý ticker (pro UI)
-- security_invoker = true zajistí, že view respektuje RLS pravidla
CREATE OR REPLACE VIEW public.latest_snapshots 
WITH (security_invoker = true) AS
SELECT DISTINCT ON (ds.user_id, sh.ticker, sh.source)
  ds.user_id,
  ds.snapshot_date,
  sh.*
FROM public.snapshot_holdings sh
JOIN public.daily_snapshots ds ON sh.snapshot_id = ds.id
ORDER BY ds.user_id, sh.ticker, sh.source, ds.snapshot_date DESC;

-- View: Pouze změny (pro historii)
CREATE OR REPLACE VIEW public.snapshot_changes 
WITH (security_invoker = true) AS
SELECT 
  ds.user_id,
  ds.snapshot_date,
  sh.*
FROM public.snapshot_holdings sh
JOIN public.daily_snapshots ds ON sh.snapshot_id = ds.id
WHERE sh.signal_changed = TRUE 
   OR sh.conviction_changed = TRUE 
   OR sh.score_changed = TRUE
   OR sh.price_changed = TRUE
ORDER BY ds.snapshot_date DESC;

-- View: Research tracked s aktuálními daty
CREATE OR REPLACE VIEW public.research_tracked_summary 
WITH (security_invoker = true) AS
SELECT 
  rt.*,
  CASE 
    WHEN rt.added_price > 0 THEN 
      ROUND((rt.current_price - rt.added_price) / rt.added_price * 100, 2)
    ELSE NULL
  END as calculated_change_pct,
  EXTRACT(DAY FROM NOW() - rt.added_at) as days_tracked
FROM public.research_tracked rt
WHERE rt.status = 'active';

-- =====================================================
-- 8. KOMENTÁŘE
-- =====================================================
COMMENT ON TABLE daily_snapshots IS 'Denní souhrny portfolia a research - jeden záznam na uživatele a den';
COMMENT ON TABLE snapshot_holdings IS 'Detail jednotlivých pozic v každém snapshotu - portfolio i research';
COMMENT ON TABLE research_tracked IS 'Akcie přidané do sledování z Research view';
COMMENT ON COLUMN snapshot_holdings.signal_changed IS 'TRUE pokud se primary_signal změnil od předchozího dne';
COMMENT ON COLUMN snapshot_holdings.source IS 'portfolio = držená pozice, research = sledovaná z research';
