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
 * - ACTION: What to do (verbs - koupit, akumulovat, držet, etc.)
 * - QUALITY: Stock assessment (adjectives - kvalitní, stabilní, slabá, etc.)
 */
export const SIGNAL_CONFIG: Record<SignalType, SignalConfig> = {
  // === ACTION SIGNALS (what to do - verbs) ===
  DIP_OPPORTUNITY: {
    label: 'Koupit dip',
    class: 'dip',
    description:
      'Přeprodáno se solidními fundamenty – potenciální příležitost k nákupu',
  },
  BREAKOUT: {
    label: 'Nakoupit průlom',
    class: 'breakout',
    description: 'Cena prorazila nad Bollinger Band s vysokým objemem',
  },
  REVERSAL: {
    label: 'Chytat obrat',
    class: 'reversal',
    description: 'MACD divergence naznačuje potenciální obrat trendu',
  },
  MOMENTUM: {
    label: 'Jet s trendem',
    class: 'momentum',
    description: 'Technické indikátory ukazují býčí momentum',
  },
  ACCUMULATE: {
    label: 'Akumulovat',
    class: 'accumulate',
    description: 'Kvalitní akcie – pokračuj v postupném nákupu (DCA)',
  },
  GOOD_ENTRY: {
    label: 'Vstoupit',
    class: 'good-entry',
    description: 'Kvalitní akcie pod cílovou cenou analytiků – vhodné k nákupu',
  },
  WAIT_FOR_DIP: {
    label: 'Počkat na pokles',
    class: 'wait',
    description: 'Kvalitní akcie, ale cena příliš vysoká – vyčkej na pokles',
  },
  NEAR_TARGET: {
    label: 'Připravit exit',
    class: 'target',
    description: 'Blíží se k cílové ceně – připrav strategii výstupu',
  },
  TAKE_PROFIT: {
    label: 'Vybrat zisk',
    class: 'take-profit',
    description: 'Vysoký zisk (+50%) – zvažte částečnou realizaci',
  },
  TRIM: {
    label: 'Redukovat',
    class: 'trim',
    description: 'Překoupeno s vysokou vahou – sniž pozici',
  },
  WATCH: {
    label: 'Sledovat',
    class: 'watch',
    description: 'Některé metriky se zhoršují – dávej pozor',
  },
  HOLD: {
    label: 'Držet',
    class: 'hold',
    description: 'Kvalitní akcie – pokračuj v držení',
  },

  // === QUALITY SIGNALS (stock assessment - adjectives) ===
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
    label: 'Podhodnocená',
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
    description: 'Solidní akcie bez výrazných problémů',
  },
  FUNDAMENTALLY_WEAK: {
    label: 'Slabé fundamenty',
    class: 'fundamentally-weak',
    description: 'Slabé fundamenty, ale technicky OK',
  },
  TECHNICALLY_WEAK: {
    label: 'Slabá technika',
    class: 'technically-weak',
    description: 'Dobré fundamenty, ale špatný timing',
  },
  PROBLEMATIC: {
    label: 'Problémová',
    class: 'problematic',
    description: 'Slabé fundamenty i technika',
  },
  WEAK: {
    label: 'Slabá',
    class: 'weak',
    description: 'Slabé fundamenty nebo trend',
  },
  OVERBOUGHT: {
    label: 'Překoupená',
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
