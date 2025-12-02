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
    label: 'DIP',
    class: 'dip',
    description:
      'Přeprodáno se solidními fundamenty – potenciální příležitost k nákupu',
  },
  BREAKOUT: {
    label: 'Průlom',
    class: 'breakout',
    description: 'Cena prorazila nad Bollinger Band s vysokým objemem',
  },
  REVERSAL: {
    label: 'Obrat',
    class: 'reversal',
    description: 'Technické signály ukazují potenciální obrat trendu',
  },
  MOMENTUM: {
    label: 'Momentum',
    class: 'momentum',
    description: 'Technické indikátory ukazují býčí momentum',
  },
  ACCUMULATE: {
    label: 'Akumulovat',
    class: 'accumulate',
    description: 'Kvalitní akcie – čekejte na lepší vstup nebo DCA',
  },
  GOOD_ENTRY: {
    label: 'Dobrý vstup',
    class: 'good-entry',
    description: 'Kvalitní akcie pod cílovou cenou analytiků – vhodné k nákupu',
  },
  WAIT_FOR_DIP: {
    label: 'Počkat',
    class: 'wait',
    description: 'Kvalitní akcie, ale cena příliš vysoká – vyčkejte na pokles',
  },
  NEAR_TARGET: {
    label: 'U cíle',
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

  // === QUALITY SIGNALS (stock assessment) ===
  CONVICTION: {
    label: 'Přesvědčení',
    class: 'conviction',
    description: 'Silné dlouhodobé fundamenty – držet přes volatilitu',
  },
  QUALITY_CORE: {
    label: 'Kvalita',
    class: 'quality',
    description: 'Vysoké fundamenty a pozitivní sentiment analytiků',
  },
  UNDERVALUED: {
    label: 'Podhodnoceno',
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
