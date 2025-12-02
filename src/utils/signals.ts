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
 *
 * Categories:
 * - ACTION: What to do (DIP, BREAKOUT, MOMENTUM, ACCUMULATE, etc.)
 * - QUALITY: Stock assessment (CONVICTION, QUALITY_CORE, STEADY, etc.)
 */
export const SIGNAL_CONFIG: Record<SignalType, SignalConfig> = {
  // === ACTION SIGNALS (what to do) ===
  DIP_OPPORTUNITY: {
    label: 'Výhodná cena',
    class: 'dip',
    description:
      'Přeprodáno se solidními fundamenty – potenciální příležitost k nákupu',
  },
  BREAKOUT: {
    label: 'Průlom objemu',
    class: 'breakout',
    description: 'Cena prorazila nad Bollinger Band s vysokým objemem',
  },
  REVERSAL: {
    label: 'Začátek růstu',
    class: 'reversal',
    description: 'MACD divergence naznačuje potenciální obrat trendu',
  },
  MOMENTUM: {
    label: 'Pokračující růst',
    class: 'momentum',
    description: 'Technické indikátory ukazují býčí momentum',
  },
  ACCUMULATE: {
    label: 'Akumulovat DCA',
    class: 'accumulate',
    description: 'Kvalitní akcie – pokračuj v postupném nákupu',
  },
  GOOD_ENTRY: {
    label: 'Příležitost k nákupu',
    class: 'good-entry',
    description: 'Kvalitní akcie pod cílovou cenou analytiků – vhodné k nákupu',
  },
  WAIT_FOR_DIP: {
    label: 'Počkat na pokles',
    class: 'wait',
    description: 'Kvalitní akcie, ale cena příliš vysoká – vyčkej na pokles',
  },
  NEAR_TARGET: {
    label: 'Blízko cíle',
    class: 'target',
    description: 'Blíží se k cílové ceně analytiků',
  },
  TAKE_PROFIT: {
    label: 'Vybrat zisk',
    class: 'take-profit',
    description: 'Vysoký zisk (+50%) – zvažte částečnou realizaci',
  },
  CONSIDER_TRIM: {
    label: 'Redukovat',
    class: 'trim',
    description: 'Překoupeno s vysokou vahou – zvažte realizaci zisku',
  },
  HOLD: {
    label: 'Držet',
    class: 'hold',
    description: 'Kvalitní akcie – pokračuj v držení, případně DCA',
  },
  FUNDAMENTALLY_WEAK: {
    label: 'Fundamentálně slabá',
    class: 'fundamentally-weak',
    description: 'Slabé fundamenty, ale technicky OK – riskantní pozice',
  },
  TECHNICALLY_WEAK: {
    label: 'Technicky slabá',
    class: 'technically-weak',
    description: 'Dobré fundamenty, ale špatný timing – vyčkej',
  },
  PROBLEMATIC: {
    label: 'Problémová',
    class: 'problematic',
    description: 'Slabé fundamenty i technika – zvažuj prodej',
  },

  // === QUALITY SIGNALS (stock assessment) ===
  CONVICTION: {
    label: 'Nejvyšší kvalita',
    class: 'conviction',
    description: 'Silné dlouhodobé fundamenty – držet přes volatilitu',
  },
  QUALITY_CORE: {
    label: 'Kvalitní',
    class: 'quality',
    description: 'Vysoké fundamenty a pozitivní sentiment analytiků',
  },
  UNDERVALUED: {
    label: 'Růstový potenciál',
    class: 'undervalued',
    description: 'Potenciál 30%+ růst dle cílové ceny analytiků',
  },
  STRONG_TREND: {
    label: 'Silný trend',
    class: 'strong-trend',
    description: 'Silný trend potvrzený vysokým ADX',
  },
  STEADY: {
    label: 'Stabilní',
    class: 'steady',
    description: 'Solidní akcie – pokračujte v držení, žádná akce',
  },
  WATCH: {
    label: 'Sledovat',
    class: 'watch',
    description: 'Některé metriky se zhoršují – monitorujte',
  },
  WEAK: {
    label: 'Slabé',
    class: 'weak',
    description: 'Slabé fundamenty nebo trend',
  },
  OVERBOUGHT: {
    label: 'Překoupeno',
    class: 'overbought',
    description: 'RSI a Stochastic ukazují překoupenou zónu',
  },
  NEUTRAL: {
    label: 'Neutrální',
    class: 'neutral',
    description: 'Žádné silné signály',
  },
};

/**
 * Get signal configuration by type
 */
export function getSignalConfig(type: SignalType): SignalConfig {
  return SIGNAL_CONFIG[type] || SIGNAL_CONFIG.NEUTRAL;
}
