-- =====================================================
-- Migration: Add previous values to snapshot_holdings
-- =====================================================
-- Store previous values when changes are detected so we can show
-- "from → to" in the UI (e.g., "MOMENTUM → WATCH")
-- =====================================================

-- Add columns for previous values
ALTER TABLE public.snapshot_holdings
ADD COLUMN IF NOT EXISTS prev_signal VARCHAR(50),
ADD COLUMN IF NOT EXISTS prev_conviction_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS prev_composite_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS prev_price DECIMAL(15,4);

-- Update trigger function to store previous values
CREATE OR REPLACE FUNCTION public.detect_snapshot_changes()
RETURNS TRIGGER AS $$
DECLARE
  prev public.snapshot_holdings;
  current_user_id UUID;
  current_snapshot_date DATE;
BEGIN
  -- Get user_id and snapshot_date from the parent snapshot
  SELECT user_id, snapshot_date INTO current_user_id, current_snapshot_date
  FROM public.daily_snapshots 
  WHERE id = NEW.snapshot_id;
  
  -- If we couldn't get user info, just return without changes
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get previous snapshot for this ticker using direct assignment
  prev := public.get_previous_snapshot(
    current_user_id,
    NEW.ticker,
    NEW.source,
    current_snapshot_date
  );
  
  -- If no previous snapshot found, return without changes
  IF prev.id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Signal changed
  NEW.signal_changed := (NEW.primary_signal IS DISTINCT FROM prev.primary_signal);
  IF NEW.signal_changed THEN
    NEW.prev_signal := prev.primary_signal;
  END IF;
  
  -- Conviction changed
  NEW.conviction_changed := (NEW.conviction_level IS DISTINCT FROM prev.conviction_level);
  IF NEW.conviction_changed THEN
    NEW.prev_conviction_level := prev.conviction_level;
  END IF;
  
  -- Score changed (> 5 points difference)
  NEW.score_changed := (
    NEW.composite_score IS NOT NULL AND 
    prev.composite_score IS NOT NULL AND
    ABS(NEW.composite_score - prev.composite_score) > 5
  );
  IF NEW.score_changed THEN
    NEW.prev_composite_score := prev.composite_score;
  END IF;
  
  -- Price changed (> 3% change)
  NEW.price_changed := (
    NEW.current_price IS NOT NULL AND 
    prev.current_price IS NOT NULL AND
    prev.current_price > 0 AND
    ABS((NEW.current_price - prev.current_price) / prev.current_price * 100) > 3
  );
  IF NEW.price_changed THEN
    NEW.prev_price := prev.current_price;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.detect_snapshot_changes IS 
  'Trigger function to detect changes from previous snapshot. Stores previous values for UI display.';

-- Backfill previous values for existing changed records
UPDATE snapshot_holdings sh
SET 
  prev_signal = (
    SELECT primary_signal FROM get_previous_snapshot(
      (SELECT user_id FROM daily_snapshots WHERE id = sh.snapshot_id),
      sh.ticker, sh.source,
      (SELECT snapshot_date FROM daily_snapshots WHERE id = sh.snapshot_id)
    )
  )
WHERE sh.signal_changed = true AND sh.prev_signal IS NULL;

UPDATE snapshot_holdings sh
SET 
  prev_conviction_level = (
    SELECT conviction_level FROM get_previous_snapshot(
      (SELECT user_id FROM daily_snapshots WHERE id = sh.snapshot_id),
      sh.ticker, sh.source,
      (SELECT snapshot_date FROM daily_snapshots WHERE id = sh.snapshot_id)
    )
  )
WHERE sh.conviction_changed = true AND sh.prev_conviction_level IS NULL;

UPDATE snapshot_holdings sh
SET 
  prev_composite_score = (
    SELECT composite_score FROM get_previous_snapshot(
      (SELECT user_id FROM daily_snapshots WHERE id = sh.snapshot_id),
      sh.ticker, sh.source,
      (SELECT snapshot_date FROM daily_snapshots WHERE id = sh.snapshot_id)
    )
  )
WHERE sh.score_changed = true AND sh.prev_composite_score IS NULL;

UPDATE snapshot_holdings sh
SET 
  prev_price = (
    SELECT current_price FROM get_previous_snapshot(
      (SELECT user_id FROM daily_snapshots WHERE id = sh.snapshot_id),
      sh.ticker, sh.source,
      (SELECT snapshot_date FROM daily_snapshots WHERE id = sh.snapshot_id)
    )
  )
WHERE sh.price_changed = true AND sh.prev_price IS NULL;
