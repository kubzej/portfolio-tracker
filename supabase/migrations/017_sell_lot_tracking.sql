-- Migration: Add lot tracking for SELL transactions
-- This allows tracking which specific BUY transaction(s) a SELL is associated with
-- =====================================================

-- Add source_transaction_id to link SELL to specific BUY lot
-- NULL means: sell entire position (all lots) or legacy behavior
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS source_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_source_transaction 
ON transactions(source_transaction_id) 
WHERE source_transaction_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN transactions.source_transaction_id IS 
'For SELL: references the specific BUY transaction (lot) being sold. NULL means selling entire position (all remaining shares).';
