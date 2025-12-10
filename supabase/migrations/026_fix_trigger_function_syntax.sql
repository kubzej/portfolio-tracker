-- =====================================================
-- Migration: Fix trigger function syntax
-- =====================================================
-- Problem: The original trigger function used "SELECT * INTO prev FROM func()"
-- which doesn't work correctly with table-returning functions in plpgsql.
-- 
-- Solution: Use direct assignment "prev := func()" instead.
-- Also added debug warnings for troubleshooting.
-- =====================================================

-- Drop and recreate the trigger function with fixed syntax
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Add comment
COMMENT ON FUNCTION public.detect_snapshot_changes IS 
  'Trigger function to detect changes from previous snapshot. Uses SECURITY DEFINER to bypass RLS. Fixed in migration 026 to use direct assignment syntax.';
