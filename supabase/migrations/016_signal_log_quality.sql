-- =====================================================
-- Add quality_signal, conviction_level, insider_score to signal_log
-- =====================================================

-- Add quality_signal column
ALTER TABLE signal_log 
ADD COLUMN IF NOT EXISTS quality_signal VARCHAR(50);

-- Add conviction_level column (extracted from metadata for easier querying)
ALTER TABLE signal_log 
ADD COLUMN IF NOT EXISTS conviction_level VARCHAR(10);

-- Add insider_score column
ALTER TABLE signal_log 
ADD COLUMN IF NOT EXISTS insider_score DECIMAL(5, 2);

-- Add index for quality_signal
CREATE INDEX IF NOT EXISTS idx_signal_log_quality 
  ON signal_log(quality_signal);

-- Add index for conviction_level
CREATE INDEX IF NOT EXISTS idx_signal_log_conviction 
  ON signal_log(conviction_level);

-- Update existing records - extract conviction_level from metadata
UPDATE signal_log 
SET conviction_level = metadata->>'convictionLevel'
WHERE conviction_level IS NULL 
  AND metadata->>'convictionLevel' IS NOT NULL;
