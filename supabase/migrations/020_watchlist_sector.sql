-- Migration: Add sector column to watchlist_items
-- This allows users to categorize stocks in their watchlist by sector

-- Add sector column (TEXT, nullable - user can leave it empty)
ALTER TABLE watchlist_items
ADD COLUMN IF NOT EXISTS sector TEXT;

-- Add comment for documentation
COMMENT ON COLUMN watchlist_items.sector IS 'Industry/sector of the stock (e.g., Technology, Healthcare). Can be set manually or auto-filled from research.';
