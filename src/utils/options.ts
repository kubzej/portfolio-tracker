/**
 * Options Trading Utilities
 *
 * Funkce pro práci s opcemi:
 * - Generování a parsování OCC symbolů
 * - Výpočet DTE (Days to Expiration)
 * - Výpočet hodnoty pozice
 * - Moneyness (ITM/ATM/OTM)
 */

import type { OptionType, OptionPosition } from '@/types';

// ==========================================
// OCC Symbol Functions
// ==========================================

/**
 * Generuje OCC symbol z parametrů opce
 *
 * Formát: [Ticker][YYMMDD][C/P][Strike × 1000 (8 znaků, padding nulami)]
 * (Bez padding mezer - kompatibilní s Yahoo Finance)
 *
 * @example
 * generateOCCSymbol('AAPL', 150, new Date('2025-01-17'), 'call')
 * // Returns: 'AAPL250117C00150000'
 *
 * generateOCCSymbol('TSLA', 200.5, new Date('2025-03-21'), 'put')
 * // Returns: 'TSLA250321P00200500'
 */
export function generateOCCSymbol(
  ticker: string,
  strike: number,
  expirationDate: Date | string,
  optionType: OptionType
): string {
  // Ticker - uppercase, bez paddingu
  const tickerClean = ticker.toUpperCase().trim();

  // Datum - YYMMDD
  const date =
    typeof expirationDate === 'string'
      ? new Date(expirationDate)
      : expirationDate;
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Typ - C nebo P
  const typeChar = optionType === 'call' ? 'C' : 'P';

  // Strike - × 1000, 8 znaků, padding nulami vlevo
  // Např. 150 -> 00150000, 200.5 -> 00200500
  const strikeInt = Math.round(strike * 1000);
  const strikePadded = String(strikeInt).padStart(8, '0');

  return `${tickerClean}${dateStr}${typeChar}${strikePadded}`;
}

/**
 * Parsuje OCC symbol zpět na parametry
 * Zvládá oba formáty - s padding mezerami (21 znaků) i bez (15-21 znaků)
 *
 * @example
 * parseOCCSymbol('AAPL250117C00150000')
 * // Returns: { ticker: 'AAPL', strike: 150, expirationDate: '2025-01-17', optionType: 'call' }
 */
export function parseOCCSymbol(occSymbol: string): {
  ticker: string;
  strike: number;
  expirationDate: string;
  optionType: OptionType;
} | null {
  // Remove any whitespace from the symbol
  const cleanSymbol = occSymbol.replace(/\s/g, '');

  // OCC symbol without padding: ticker (1-6) + date (6) + type (1) + strike (8) = 16-21 chars
  // Minimum is 16 chars (1 char ticker + 6 date + 1 type + 8 strike)
  if (cleanSymbol.length < 16 || cleanSymbol.length > 21) {
    return null;
  }

  try {
    // Find the position of C or P (option type indicator)
    // It's always 6 chars from the end (before 8-digit strike)
    const typePosition = cleanSymbol.length - 9;
    const typeChar = cleanSymbol.charAt(typePosition);

    if (typeChar !== 'C' && typeChar !== 'P') {
      return null;
    }

    // Ticker - everything before the date (6 chars before type)
    const ticker = cleanSymbol.slice(0, typePosition - 6).trim();

    // Datum - 6 znaky před type (YYMMDD)
    const dateStr = cleanSymbol.slice(typePosition - 6, typePosition);
    const year = parseInt(dateStr.slice(0, 2), 10);
    const month = parseInt(dateStr.slice(2, 4), 10);
    const day = parseInt(dateStr.slice(4, 6), 10);

    // Předpokládáme 2000+ pro rok
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    const expirationDate = `${fullYear}-${String(month).padStart(
      2,
      '0'
    )}-${String(day).padStart(2, '0')}`;

    // Typ
    const optionType: OptionType = typeChar === 'C' ? 'call' : 'put';

    // Strike - posledních 8 znaků, děleno 1000
    const strikeInt = parseInt(cleanSymbol.slice(-8), 10);
    const strike = strikeInt / 1000;

    return {
      ticker,
      strike,
      expirationDate,
      optionType,
    };
  } catch {
    return null;
  }
}

/**
 * Formátuje opci pro zobrazení v UI
 *
 * @example
 * formatOptionDisplay('AAPL', 150, '2025-01-17', 'call')
 * // Returns: 'AAPL $150 Call 17 Jan 2025'
 */
export function formatOptionDisplay(
  ticker: string,
  strike: number,
  expirationDate: string,
  optionType: OptionType
): string {
  const date = new Date(expirationDate);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const type = optionType === 'call' ? 'Call' : 'Put';

  return `${ticker} $${strike} ${type} ${day} ${month} ${year}`;
}

/**
 * Formátuje opci do krátkého formátu pro tabulky
 *
 * @example
 * formatOptionShort(150, '2025-01-17', 'call')
 * // Returns: '$150 C 17/1'
 */
export function formatOptionShort(
  strike: number,
  expirationDate: string,
  optionType: OptionType
): string {
  const date = new Date(expirationDate);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const type = optionType === 'call' ? 'C' : 'P';

  return `$${strike} ${type} ${day}/${month}`;
}

// ==========================================
// DTE (Days to Expiration) Functions
// ==========================================

/**
 * Vypočítá počet dní do expirace
 *
 * @returns Počet dní (může být záporný pro expirované opce)
 */
export function calculateDTE(expirationDate: Date | string): number {
  const expDate =
    typeof expirationDate === 'string'
      ? new Date(expirationDate)
      : expirationDate;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Vrací kategorii DTE pro barevné kódování v UI
 */
export function getDTECategory(
  dte: number
): 'critical' | 'warning' | 'ok' | 'expired' {
  if (dte < 0) return 'expired';
  if (dte <= 7) return 'critical';
  if (dte <= 14) return 'warning';
  return 'ok';
}

/**
 * Formátuje DTE pro zobrazení
 *
 * @example
 * formatDTE(5)  // Returns: '5d'
 * formatDTE(0)  // Returns: 'Today'
 * formatDTE(-1) // Returns: 'Expired'
 */
export function formatDTE(dte: number): string {
  if (dte < 0) return 'Expired';
  if (dte === 0) return 'Today';
  return `${dte}d`;
}

// ==========================================
// Value Calculations
// ==========================================

/**
 * Vypočítá celkovou hodnotu opční pozice
 *
 * @param contracts Počet kontraktů
 * @param premium Cena za akcii
 * @param multiplier Násobitel (defaultně 100 pro US opce)
 */
export function calculateOptionValue(
  contracts: number,
  premium: number,
  multiplier: number = 100
): number {
  return contracts * premium * multiplier;
}

/**
 * Vypočítá unrealized P/L pro opční pozici
 *
 * @param position 'long' nebo 'short'
 * @param contracts Počet kontraktů
 * @param avgPremium Průměrná nákupní/prodejní cena
 * @param currentPrice Aktuální cena opce
 * @param multiplier Násobitel (defaultně 100)
 */
export function calculateOptionPL(
  position: OptionPosition,
  contracts: number,
  avgPremium: number,
  currentPrice: number,
  multiplier: number = 100
): number {
  const costBasis = contracts * avgPremium * multiplier;
  const currentValue = contracts * currentPrice * multiplier;

  if (position === 'long') {
    // Long: zisk když cena roste
    return currentValue - costBasis;
  } else {
    // Short: zisk když cena klesá
    return costBasis - currentValue;
  }
}

/**
 * Vypočítá P/L jako procento
 */
export function calculateOptionPLPercent(
  position: OptionPosition,
  avgPremium: number,
  currentPrice: number
): number {
  if (avgPremium === 0) return 0;

  if (position === 'long') {
    return ((currentPrice - avgPremium) / avgPremium) * 100;
  } else {
    return ((avgPremium - currentPrice) / avgPremium) * 100;
  }
}

// ==========================================
// Moneyness Functions
// ==========================================

export type Moneyness = 'ITM' | 'ATM' | 'OTM';

/**
 * Určí moneyness opce (ITM/ATM/OTM)
 *
 * @param optionType 'call' nebo 'put'
 * @param stockPrice Aktuální cena akcie
 * @param strike Realizační cena
 * @param atmThreshold Práh pro ATM v procentech (default 2%)
 */
export function getMoneyness(
  optionType: OptionType,
  stockPrice: number,
  strike: number,
  atmThreshold: number = 2
): Moneyness {
  const percentDiff = Math.abs((stockPrice - strike) / strike) * 100;

  // ATM pokud je cena v rozmezí ±threshold od strike
  if (percentDiff <= atmThreshold) {
    return 'ATM';
  }

  if (optionType === 'call') {
    // Call je ITM když cena akcie > strike
    return stockPrice > strike ? 'ITM' : 'OTM';
  } else {
    // Put je ITM když cena akcie < strike
    return stockPrice < strike ? 'ITM' : 'OTM';
  }
}

/**
 * Vrací popis moneyness
 */
export function getMoneynessLabel(moneyness: Moneyness): string {
  switch (moneyness) {
    case 'ITM':
      return 'In The Money';
    case 'ATM':
      return 'At The Money';
    case 'OTM':
      return 'Out of The Money';
  }
}

// ==========================================
// Break-even Calculations
// ==========================================

/**
 * Vypočítá break-even cenu opce
 *
 * @param optionType 'call' nebo 'put'
 * @param strike Realizační cena
 * @param premium Zaplacené premium
 */
export function calculateBreakeven(
  optionType: OptionType,
  strike: number,
  premium: number
): number {
  if (optionType === 'call') {
    // Long Call: break-even = strike + premium
    return strike + premium;
  } else {
    // Long Put: break-even = strike - premium
    return strike - premium;
  }
}

// ==========================================
// Max Profit / Max Loss Functions
// ==========================================

export interface MaxProfitLoss {
  maxProfit: number | 'unlimited';
  maxLoss: number | 'unlimited';
  maxProfitDescription: string;
  maxLossDescription: string;
}

/**
 * Vypočítá maximální profit a loss pro opční pozici
 *
 * @param optionType 'call' nebo 'put'
 * @param position 'long' nebo 'short'
 * @param strike Realizační cena
 * @param premium Zaplacené/obdržené premium (per share)
 * @param contracts Počet kontraktů
 * @param multiplier Násobitel (default 100)
 */
export function calculateMaxProfitLoss(
  optionType: OptionType,
  position: OptionPosition,
  strike: number,
  premium: number,
  contracts: number = 1,
  multiplier: number = 100
): MaxProfitLoss {
  const totalPremium = premium * contracts * multiplier;

  if (position === 'long') {
    if (optionType === 'call') {
      // Long Call: max loss = premium, max profit = unlimited
      return {
        maxProfit: 'unlimited',
        maxLoss: totalPremium,
        maxProfitDescription: 'Neomezený (akcie může růst neomezeně)',
        maxLossDescription: `${totalPremium.toFixed(0)} USD (zaplacené premium)`,
      };
    } else {
      // Long Put: max loss = premium, max profit = (strike - premium) × contracts × 100
      const maxProfit = (strike - premium) * contracts * multiplier;
      return {
        maxProfit: Math.max(0, maxProfit),
        maxLoss: totalPremium,
        maxProfitDescription: `${maxProfit.toFixed(0)} USD (akcie klesne na 0)`,
        maxLossDescription: `${totalPremium.toFixed(0)} USD (zaplacené premium)`,
      };
    }
  } else {
    // Short positions
    if (optionType === 'call') {
      // Short Call: max profit = premium, max loss = unlimited
      return {
        maxProfit: totalPremium,
        maxLoss: 'unlimited',
        maxProfitDescription: `${totalPremium.toFixed(0)} USD (obdržené premium)`,
        maxLossDescription: 'Neomezená (akcie může růst neomezeně)',
      };
    } else {
      // Short Put: max profit = premium, max loss = (strike - premium) × contracts × 100
      const maxLoss = (strike - premium) * contracts * multiplier;
      return {
        maxProfit: totalPremium,
        maxLoss: Math.max(0, maxLoss),
        maxProfitDescription: `${totalPremium.toFixed(0)} USD (obdržené premium)`,
        maxLossDescription: `${maxLoss.toFixed(0)} USD (akcie klesne na 0)`,
      };
    }
  }
}

/**
 * Odhaduje pravděpodobnost profitu z Delta
 * Delta přibližně odpovídá pravděpodobnosti, že opce expiruje ITM
 *
 * @param delta Delta opce (0 až 1 pro calls, -1 až 0 pro puts)
 * @param position 'long' nebo 'short'
 */
export function estimateProbabilityOfProfit(
  delta: number | null,
  position: OptionPosition
): number | null {
  if (delta === null) return null;

  // Delta přibližně = pravděpodobnost ITM
  const probITM = Math.abs(delta) * 100;

  if (position === 'long') {
    // Long opce: profit když ITM
    return probITM;
  } else {
    // Short opce: profit když OTM (opce expiruje bezcenná)
    return 100 - probITM;
  }
}

// ==========================================
// Validation Functions
// ==========================================

/**
 * Validuje OCC symbol
 */
export function isValidOCCSymbol(symbol: string): boolean {
  if (symbol.length !== 21) return false;

  const typeChar = symbol.charAt(12);
  if (typeChar !== 'C' && typeChar !== 'P') return false;

  const strikeStr = symbol.slice(13, 21);
  if (!/^\d{8}$/.test(strikeStr)) return false;

  return true;
}

/**
 * Validuje datum expirace (musí být v budoucnosti nebo dnes)
 */
export function isValidExpiration(expirationDate: Date | string): boolean {
  const dte = calculateDTE(expirationDate);
  return dte >= 0;
}
