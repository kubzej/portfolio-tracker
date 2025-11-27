-- Add finnhub_ticker column for Finnhub API compatibility
-- Finnhub uses different symbols for European stocks (e.g., ZAL instead of ZAL.DE)

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS finnhub_ticker VARCHAR(20);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stocks_finnhub_ticker ON stocks(finnhub_ticker);

-- Add comment explaining usage
COMMENT ON COLUMN stocks.finnhub_ticker IS 'Ticker symbol for Finnhub API. May differ from main ticker for non-US stocks (e.g., ZAL for XETRA instead of ZAL.DE)';
