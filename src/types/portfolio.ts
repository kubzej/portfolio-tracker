// Portfolio related types
// Note: These are legacy types for the initial mock data
// For database types, see database.ts

export interface PortfolioBalance {
  totalValue: number;
  totalGain: number;
  totalGainPercentage: number;
  currency: string;
}

export interface PortfolioStock {
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number;
  averageCost: number;
  totalValue: number;
  gain: number;
  gainPercentage: number;
}

export interface Portfolio {
  balance: PortfolioBalance;
  stocks: PortfolioStock[];
}
