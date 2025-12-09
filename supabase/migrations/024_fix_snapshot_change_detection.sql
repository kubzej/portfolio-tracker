-- =====================================================
-- Migration: Fix snapshot change detection
-- =====================================================
-- Problem: The trigger detect_snapshot_changes and helper function
-- get_previous_snapshot don't have SECURITY DEFINER, so they can't
-- read previous snapshot data due to RLS policies.
-- 
-- Solution: Add SECURITY DEFINER to both functions so they can
-- access data regardless of RLS when detecting changes.
-- =====================================================

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trigger_detect_snapshot_changes ON public.snapshot_holdings;

-- Drop and recreate the helper function with SECURITY DEFINER
DROP FUNCTION IF EXISTS public.get_previous_snapshot(UUID, VARCHAR, VARCHAR, DATE);

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
SECURITY DEFINER
SET search_path = public;

-- Drop and recreate the trigger function with SECURITY DEFINER
DROP FUNCTION IF EXISTS public.detect_snapshot_changes() CASCADE;

CREATE OR REPLACE FUNCTION public.detect_snapshot_changes()
RETURNS TRIGGER AS $$
DECLARE
  prev public.snapshot_holdings;
  current_user_id UUID;
  current_date DATE;
BEGIN
  -- Get user_id and snapshot_date from the parent snapshot
  SELECT user_id, snapshot_date INTO current_user_id, current_date
  FROM public.daily_snapshots 
  WHERE id = NEW.snapshot_id;
  
  -- Get previous snapshot for this ticker
  SELECT * INTO prev FROM public.get_previous_snapshot(
    current_user_id,
    NEW.ticker,
    NEW.source,
    current_date
  );
  
  IF prev IS NOT NULL THEN
    -- Signal changed
    NEW.signal_changed := (NEW.primary_signal IS DISTINCT FROM prev.primary_signal);
    
    -- Conviction changed
    NEW.conviction_changed := (NEW.conviction_level IS DISTINCT FROM prev.conviction_level);
    
    -- Score changed (> 5 points difference)
    NEW.score_changed := (
      NEW.composite_score IS NOT NULL AND 
      prev.composite_score IS NOT NULL AND
      ABS(NEW.composite_score - prev.composite_score) > 5
    );
    
    -- Price changed (> 3% change)
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
SECURITY DEFINER
SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER trigger_detect_snapshot_changes
  BEFORE INSERT ON public.snapshot_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_snapshot_changes();

-- Add comments
COMMENT ON FUNCTION public.get_previous_snapshot IS 'Get the most recent snapshot holding for a ticker before a given date. Uses SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION public.detect_snapshot_changes IS 'Trigger function to detect changes from previous snapshot. Uses SECURITY DEFINER to bypass RLS.';
