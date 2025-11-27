import { PortfolioBalance } from '@/types';

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Hardcoded mock data - will be replaced with real API calls later
const mockBalance: PortfolioBalance = {
  totalValue: 125750.5,
  totalGain: 15230.75,
  totalGainPercentage: 13.78,
  currency: 'USD',
};

export const portfolioApi = {
  /**
   * Fetches the portfolio balance
   * Currently returns hardcoded data, will be replaced with real API call
   */
  async getBalance(): Promise<PortfolioBalance> {
    // Simulate network delay
    await delay(500);

    // TODO: Replace with actual API call
    // const response = await fetch('/api/portfolio/balance')
    // return response.json()

    return mockBalance;
  },
};
