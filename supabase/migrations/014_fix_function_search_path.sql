-- =====================================================
-- Migration: Fix function search_path security
-- =====================================================
-- Supabase security linter warns about functions with mutable search_path.
-- This migration recreates all functions with SET search_path = '' to prevent
-- potential search_path injection attacks.
-- =====================================================

-- 1. Fix calculate_transaction_totals
CREATE OR REPLACE FUNCTION public.calculate_transaction_totals()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_amount := NEW.quantity * NEW.price_per_share;
    NEW.total_amount_czk := NEW.total_amount * COALESCE(NEW.exchange_rate_to_czk, 1);
    NEW.fees_czk := NEW.fees * COALESCE(NEW.exchange_rate_to_czk, 1);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 2. Fix update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 3. Fix get_default_portfolio_id
CREATE OR REPLACE FUNCTION public.get_default_portfolio_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM public.portfolios WHERE is_default = TRUE LIMIT 1);
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 4. Fix update_portfolio_timestamp
CREATE OR REPLACE FUNCTION public.update_portfolio_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 5. Fix update_watchlist_timestamp
CREATE OR REPLACE FUNCTION public.update_watchlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 6. Fix signal_exists
CREATE OR REPLACE FUNCTION public.signal_exists(
    p_portfolio_id UUID,
    p_ticker VARCHAR,
    p_signal_type VARCHAR,
    p_days_window INTEGER DEFAULT 7
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.signal_log
        WHERE portfolio_id = p_portfolio_id
          AND ticker = p_ticker
          AND signal_type = p_signal_type
          AND created_at > NOW() - (p_days_window || ' days')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
