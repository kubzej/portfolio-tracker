-- Migration: Add foreign key constraints with ON DELETE CASCADE for user_id columns
-- This ensures that when a user is deleted, all their data is automatically deleted

-- Drop existing constraints first (if they exist without CASCADE)
ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS portfolios_user_id_fkey;
ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_user_id_fkey;
ALTER TABLE watchlists DROP CONSTRAINT IF EXISTS watchlists_user_id_fkey;

-- 1. Add foreign key to portfolios with CASCADE
ALTER TABLE portfolios
ADD CONSTRAINT portfolios_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add foreign key to stocks with CASCADE
ALTER TABLE stocks
ADD CONSTRAINT stocks_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Add foreign key to watchlists with CASCADE
ALTER TABLE watchlists
ADD CONSTRAINT watchlists_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Note: holdings and transactions are deleted via CASCADE through portfolios and stocks
-- holdings: stock_id -> stocks -> user deleted
-- transactions: holding_id -> holdings -> stock_id -> stocks -> user deleted
-- signal_log: portfolio_id -> portfolios -> user deleted
-- watchlist_items: watchlist_id -> watchlists -> user deleted
