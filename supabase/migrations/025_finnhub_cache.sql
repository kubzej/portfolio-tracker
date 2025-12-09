-- =====================================================
-- Migration: Finnhub API Cache
-- =====================================================
-- Cache pro Finnhub API data pro snížení rate limit problémů
-- Finnhub FREE tier má limit 60 volání/minutu
-- =====================================================

-- Tabulka pro cache
CREATE TABLE IF NOT EXISTS finnhub_cache (
  ticker VARCHAR(20) NOT NULL,
  data_type VARCHAR(30) NOT NULL,  -- 'recommendation', 'metrics', 'earnings', 'peers', 'profile', 'insider'
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (ticker, data_type)
);

-- Index pro rychlé čištění expirovaných záznamů
CREATE INDEX idx_finnhub_cache_expires ON finnhub_cache(expires_at);

-- Index pro rychlé vyhledávání podle tickeru
CREATE INDEX idx_finnhub_cache_ticker ON finnhub_cache(ticker);

-- Funkce pro čištění expirované cache
-- Volat cronem nebo manuálně: SELECT cleanup_expired_finnhub_cache();
CREATE OR REPLACE FUNCTION cleanup_expired_finnhub_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM finnhub_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Funkce pro smazání cache konkrétního tickeru
-- SELECT clear_finnhub_cache_for_ticker('AAPL');
CREATE OR REPLACE FUNCTION clear_finnhub_cache_for_ticker(p_ticker VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM finnhub_cache WHERE ticker = p_ticker;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Funkce pro smazání celé cache
-- SELECT clear_all_finnhub_cache();
CREATE OR REPLACE FUNCTION clear_all_finnhub_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM finnhub_cache;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- RLS - cache je sdílená pro všechny uživatele (data jsou veřejná)
-- Ale jen service_role může zapisovat
ALTER TABLE finnhub_cache ENABLE ROW LEVEL SECURITY;

-- Všichni autentizovaní uživatelé mohou číst
CREATE POLICY "Users can read cache" ON finnhub_cache
  FOR SELECT USING (true);

-- Jen service_role může zapisovat (edge functions)
CREATE POLICY "Service role can write cache" ON finnhub_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Komentáře
COMMENT ON TABLE finnhub_cache IS 'Cache pro Finnhub API data - snižuje počet API volání';
COMMENT ON COLUMN finnhub_cache.data_type IS 'Typ dat: recommendation, metrics, earnings, peers, profile, insider';
COMMENT ON COLUMN finnhub_cache.expires_at IS 'Kdy cache vyprší - různé TTL podle typu dat';
COMMENT ON FUNCTION cleanup_expired_finnhub_cache IS 'Smaže expirované záznamy, vrátí počet smazaných';
COMMENT ON FUNCTION clear_finnhub_cache_for_ticker IS 'Smaže cache pro konkrétní ticker';
COMMENT ON FUNCTION clear_all_finnhub_cache IS 'Smaže celou cache (full reset)';
