/**
 * Option Alerts System
 *
 * Generuje alertsy pro opční pozice na základě pravidel:
 * - DTE (Days to Expiration) thresholds
 * - ITM pozice
 * - Velké P/L změny
 * - Vysoký theta decay
 */

import type { OptionType, OptionPosition } from '@/types';
import type { Moneyness } from './options';

export type AlertSeverity = 'info' | 'warning' | 'danger';
export type AlertType = 'dte' | 'itm' | 'pl' | 'theta' | 'expiring';

export interface OptionAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  shortMessage: string;
  optionSymbol: string;
  ticker: string;
}

export interface AlertableOption {
  option_symbol: string;
  symbol: string; // ticker
  option_type: OptionType;
  position: OptionPosition;
  strike_price: number;
  dte: number | null;
  moneyness?: Moneyness;
  plPercent?: number;
  theta?: number | null;
  contracts: number;
  current_price?: number | null;
}

// ==========================================
// Alert Rules Configuration
// ==========================================

export const ALERT_THRESHOLDS = {
  // DTE thresholds
  DTE_DANGER: 7, // < 7 days = danger
  DTE_WARNING: 14, // < 14 days = warning
  DTE_INFO: 30, // < 30 days = info

  // P/L thresholds
  PL_DANGER_LOSS: -50, // > 50% loss = danger
  PL_WARNING_LOSS: -25, // > 25% loss = warning
  PL_INFO_GAIN: 50, // > 50% gain = info (take profit?)

  // Theta threshold (daily decay in USD)
  THETA_WARNING: 10, // > $10/day decay = warning
} as const;

// ==========================================
// Alert Generation Functions
// ==========================================

/**
 * Generuje všechny alerty pro jednu opci
 */
export function generateAlertsForOption(
  option: AlertableOption
): OptionAlert[] {
  const alerts: OptionAlert[] = [];

  // 1. DTE alerts
  const dteAlert = checkDTEAlert(option);
  if (dteAlert) alerts.push(dteAlert);

  // 2. ITM alerts (important for long positions near expiration)
  const itmAlert = checkITMAlert(option);
  if (itmAlert) alerts.push(itmAlert);

  // 3. P/L alerts
  const plAlert = checkPLAlert(option);
  if (plAlert) alerts.push(plAlert);

  // 4. Theta alerts
  const thetaAlert = checkThetaAlert(option);
  if (thetaAlert) alerts.push(thetaAlert);

  return alerts;
}

/**
 * Generuje alerty pro všechny opce
 */
export function generateAllAlerts(options: AlertableOption[]): OptionAlert[] {
  const allAlerts: OptionAlert[] = [];

  for (const option of options) {
    const alerts = generateAlertsForOption(option);
    allAlerts.push(...alerts);
  }

  // Sort by severity (danger first, then warning, then info)
  return sortAlertsBySeverity(allAlerts);
}

/**
 * Spočítá počet alertů podle severity
 */
export function countAlertsBySeverity(alerts: OptionAlert[]): {
  danger: number;
  warning: number;
  info: number;
  total: number;
} {
  return {
    danger: alerts.filter((a) => a.severity === 'danger').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    total: alerts.length,
  };
}

// ==========================================
// Individual Alert Checks
// ==========================================

function checkDTEAlert(option: AlertableOption): OptionAlert | null {
  if (option.dte === null) return null;

  const { dte, option_symbol, symbol, option_type, strike_price, position } =
    option;
  const typeLabel = option_type === 'call' ? 'C' : 'P';
  const posLabel = position.toUpperCase();

  if (dte <= 0) {
    return {
      type: 'expiring',
      severity: 'danger',
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} expiruje dnes!`,
      shortMessage: 'Expiruje dnes!',
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  }

  if (dte <= ALERT_THRESHOLDS.DTE_DANGER) {
    return {
      type: 'dte',
      severity: 'danger',
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} - pouze ${dte} dní do expirace`,
      shortMessage: `${dte}D do expirace`,
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  }

  if (dte <= ALERT_THRESHOLDS.DTE_WARNING) {
    return {
      type: 'dte',
      severity: 'warning',
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} - ${dte} dní do expirace`,
      shortMessage: `${dte}D do expirace`,
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  }

  // Info level for < 30 days is too noisy, skip it
  return null;
}

function checkITMAlert(option: AlertableOption): OptionAlert | null {
  if (!option.moneyness || option.moneyness !== 'ITM') return null;
  if (option.dte === null || option.dte > ALERT_THRESHOLDS.DTE_WARNING)
    return null;

  const { option_symbol, symbol, option_type, strike_price, position, dte } =
    option;
  const typeLabel = option_type === 'call' ? 'C' : 'P';
  const posLabel = position.toUpperCase();

  // ITM + blízká expirace = důležité rozhodnutí
  const severity: AlertSeverity =
    dte <= ALERT_THRESHOLDS.DTE_DANGER ? 'danger' : 'warning';

  if (position === 'long') {
    return {
      type: 'itm',
      severity,
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} je ITM - zvažte exercise nebo prodej`,
      shortMessage: 'ITM - rozhodnutí',
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  } else {
    return {
      type: 'itm',
      severity,
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} je ITM - riziko assignment`,
      shortMessage: 'ITM - riziko',
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  }
}

function checkPLAlert(option: AlertableOption): OptionAlert | null {
  if (option.plPercent === undefined) return null;

  const {
    plPercent,
    option_symbol,
    symbol,
    option_type,
    strike_price,
    position,
  } = option;
  const typeLabel = option_type === 'call' ? 'C' : 'P';
  const posLabel = position.toUpperCase();

  if (plPercent <= ALERT_THRESHOLDS.PL_DANGER_LOSS) {
    return {
      type: 'pl',
      severity: 'danger',
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} - velká ztráta (${plPercent.toFixed(
        0
      )}%)`,
      shortMessage: `${plPercent.toFixed(0)}% ztráta`,
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  }

  if (plPercent <= ALERT_THRESHOLDS.PL_WARNING_LOSS) {
    return {
      type: 'pl',
      severity: 'warning',
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} - ztráta ${plPercent.toFixed(
        0
      )}%`,
      shortMessage: `${plPercent.toFixed(0)}% ztráta`,
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  }

  if (plPercent >= ALERT_THRESHOLDS.PL_INFO_GAIN) {
    return {
      type: 'pl',
      severity: 'info',
      message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} - zisk ${plPercent.toFixed(
        0
      )}%, zvažte take profit`,
      shortMessage: `${plPercent.toFixed(0)}% zisk`,
      optionSymbol: option_symbol,
      ticker: symbol,
    };
  }

  return null;
}

function checkThetaAlert(option: AlertableOption): OptionAlert | null {
  if (option.theta === null || option.theta === undefined) return null;
  if (option.position !== 'long') return null; // Theta je problém hlavně pro long pozice

  const dailyDecay = Math.abs(option.theta) * option.contracts * 100;

  if (dailyDecay < ALERT_THRESHOLDS.THETA_WARNING) return null;

  const { option_symbol, symbol, option_type, strike_price, position } = option;
  const typeLabel = option_type === 'call' ? 'C' : 'P';
  const posLabel = position.toUpperCase();

  return {
    type: 'theta',
    severity: 'warning',
    message: `${symbol} ${typeLabel} $${strike_price} ${posLabel} - vysoký theta decay ($${dailyDecay.toFixed(
      0
    )}/den)`,
    shortMessage: `$${dailyDecay.toFixed(0)}/den decay`,
    optionSymbol: option_symbol,
    ticker: symbol,
  };
}

// ==========================================
// Utility Functions
// ==========================================

function sortAlertsBySeverity(alerts: OptionAlert[]): OptionAlert[] {
  const severityOrder: Record<AlertSeverity, number> = {
    danger: 0,
    warning: 1,
    info: 2,
  };

  return [...alerts].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

/**
 * Filtruje alerty pro konkrétní opci
 */
export function getAlertsForOption(
  alerts: OptionAlert[],
  optionSymbol: string
): OptionAlert[] {
  return alerts.filter((a) => a.optionSymbol === optionSymbol);
}

/**
 * Vrací nejvyšší severity z alertů
 */
export function getHighestSeverity(
  alerts: OptionAlert[]
): AlertSeverity | null {
  if (alerts.length === 0) return null;

  if (alerts.some((a) => a.severity === 'danger')) return 'danger';
  if (alerts.some((a) => a.severity === 'warning')) return 'warning';
  return 'info';
}
