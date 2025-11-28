/**
 * Signal configuration and utilities
 *
 * Centralized configuration for signal types used across the app:
 * - Recommendations
 * - Watchlist
 * - Stock Research
 */

import type { SignalType } from './recommendations';

export interface SignalConfig {
  label: string;
  class: string;
  description: string;
}

/**
 * Configuration for each signal type
 * Used for displaying signal badges consistently across the app
 */
export const SIGNAL_CONFIG: Record<SignalType, SignalConfig> = {
  DIP_OPPORTUNITY: {
    label: 'DIP',
    class: 'dip',
    description:
      'Oversold with solid fundamentals - potential buying opportunity',
  },
  MOMENTUM: {
    label: 'Momentum',
    class: 'momentum',
    description: 'Technical indicators show bullish momentum',
  },
  CONVICTION_HOLD: {
    label: 'Conviction',
    class: 'conviction',
    description: 'Strong long-term fundamentals - hold through volatility',
  },
  NEAR_TARGET: {
    label: 'Near Target',
    class: 'target',
    description: 'Approaching analyst price target',
  },
  CONSIDER_TRIM: {
    label: 'Trim',
    class: 'trim',
    description: 'Overbought with high weight - consider taking profits',
  },
  WATCH_CLOSELY: {
    label: 'Watch',
    class: 'watch',
    description: 'Some metrics are deteriorating - monitor',
  },
  ACCUMULATE: {
    label: 'Accumulate',
    class: 'accumulate',
    description: 'Good quality stock - wait for better entry',
  },
  NEUTRAL: {
    label: 'Neutral',
    class: 'neutral',
    description: 'No strong signals',
  },
};

/**
 * Get signal configuration by type
 */
export function getSignalConfig(type: SignalType): SignalConfig {
  return SIGNAL_CONFIG[type] || SIGNAL_CONFIG.NEUTRAL;
}
