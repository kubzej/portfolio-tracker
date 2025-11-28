-- Add currency column to watchlist_items
ALTER TABLE watchlist_items 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- Update existing items to have USD as default (will be corrected on next price refresh)
UPDATE watchlist_items SET currency = 'USD' WHERE currency IS NULL;
