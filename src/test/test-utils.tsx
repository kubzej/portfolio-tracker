/**
 * Test utilities and custom render functions
 */

/* eslint-disable react-refresh/only-export-components */

import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Custom providers wrapper for tests
 * Add any context providers your app needs here
 */
interface ProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: ProvidersProps) {
  // Add providers here as needed (e.g., AuthContext, ThemeProvider)
  return <>{children}</>;
}

/**
 * Custom render function that wraps components with necessary providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...options }),
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };

// Export userEvent for convenience
export { userEvent };

/**
 * Helper to wait for async operations
 */
export const waitFor = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock data generators for tests
 */
export const mockData = {
  /**
   * Generate mock analyst data
   */
  analystData: (overrides = {}) => ({
    ticker: 'AAPL',
    stockName: 'Apple Inc.',
    currentPrice: 175.5,
    previousClose: 174.0,
    change: 1.5,
    changePercent: 0.86,
    fiftyTwoWeekHigh: 199.62,
    fiftyTwoWeekLow: 143.9,
    analystTargetPrice: 195.0,
    recommendations: {
      strongBuy: 15,
      buy: 20,
      hold: 10,
      sell: 2,
      strongSell: 1,
    },
    fundamentalMetrics: {
      peRatio: 28.5,
      forwardPE: 26.2,
      pegRatio: 2.1,
      roe: 147.0,
      netMargin: 25.3,
      debtToEquity: 1.8,
      revenueGrowth: 8.5,
      epsGrowth: 10.2,
      currentRatio: 1.0,
    },
    insiderSentiment: {
      mspr: -0.15,
      change: -5000,
      monthlyData: [],
    },
    ...overrides,
  }),

  /**
   * Generate mock technical data
   */
  technicalData: (overrides = {}) => ({
    ticker: 'AAPL',
    rsi14: 55.5,
    macd: 1.2,
    macdSignal: 0.8,
    macdHistogram: 0.4,
    stochK: 65.0,
    stochD: 62.0,
    adx: 28.5,
    bollingerUpper: 185.0,
    bollingerMiddle: 175.0,
    bollingerLower: 165.0,
    sma20: 174.5,
    sma50: 172.0,
    sma200: 168.0,
    atr14: 3.5,
    ...overrides,
  }),

  /**
   * Generate mock news article
   */
  newsArticle: (overrides = {}) => ({
    id: '1',
    headline: 'Apple Reports Strong Quarterly Earnings',
    summary: 'Apple Inc. reported better-than-expected earnings...',
    source: 'Reuters',
    url: 'https://example.com/news/1',
    datetime: new Date().toISOString(),
    sentiment: 0.65,
    ...overrides,
  }),
};
