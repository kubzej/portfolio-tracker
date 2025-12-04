-- Migration: Fix security_invoker on views
-- The previous migration may not have applied security_invoker correctly
-- =====================================================

-- Set security_invoker on holdings view
ALTER VIEW holdings SET (security_invoker = true);

-- Set security_invoker on portfolio_summary view  
ALTER VIEW portfolio_summary SET (security_invoker = true);
