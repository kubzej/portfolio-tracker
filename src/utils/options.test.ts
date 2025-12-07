import { describe, it, expect } from 'vitest';
import {
  generateOCCSymbol,
  parseOCCSymbol,
  formatOptionDisplay,
  formatOptionShort,
  calculateDTE,
  getDTECategory,
  formatDTE,
  calculateOptionValue,
  calculateOptionPL,
  calculateOptionPLPercent,
  getMoneyness,
  getMoneynessLabel,
  calculateBreakeven,
  isValidOCCSymbol,
} from './options';

describe('options utils', () => {
  // ==========================================
  // OCC Symbol Functions
  // ==========================================

  describe('generateOCCSymbol', () => {
    it('should generate correct OCC symbol for AAPL call', () => {
      const result = generateOCCSymbol('AAPL', 150, '2025-01-17', 'call');
      expect(result).toBe('AAPL250117C00150000');
    });

    it('should generate correct OCC symbol for TSLA put', () => {
      const result = generateOCCSymbol('TSLA', 200, '2025-03-21', 'put');
      expect(result).toBe('TSLA250321P00200000');
    });

    it('should handle decimal strike prices', () => {
      const result = generateOCCSymbol('AAPL', 150.5, '2025-01-17', 'call');
      expect(result).toBe('AAPL250117C00150500');
    });

    it('should handle short tickers without padding', () => {
      const result = generateOCCSymbol('V', 250, '2025-06-20', 'call');
      expect(result).toBe('V250620C00250000');
    });

    it('should handle Date object input', () => {
      const result = generateOCCSymbol(
        'AAPL',
        150,
        new Date('2025-01-17'),
        'call'
      );
      expect(result).toBe('AAPL250117C00150000');
    });
  });

  describe('parseOCCSymbol', () => {
    it('should parse valid OCC symbol without spaces', () => {
      const result = parseOCCSymbol('AAPL250117C00150000');
      expect(result).toEqual({
        ticker: 'AAPL',
        strike: 150,
        expirationDate: '2025-01-17',
        optionType: 'call',
      });
    });

    it('should parse valid OCC symbol with spaces (legacy format)', () => {
      const result = parseOCCSymbol('AAPL  250117C00150000');
      expect(result).toEqual({
        ticker: 'AAPL',
        strike: 150,
        expirationDate: '2025-01-17',
        optionType: 'call',
      });
    });

    it('should parse put option correctly', () => {
      const result = parseOCCSymbol('TSLA250321P00200000');
      expect(result).toEqual({
        ticker: 'TSLA',
        strike: 200,
        expirationDate: '2025-03-21',
        optionType: 'put',
      });
    });

    it('should handle decimal strikes', () => {
      const result = parseOCCSymbol('AAPL250117C00150500');
      expect(result?.strike).toBe(150.5);
    });

    it('should handle short ticker symbols', () => {
      const result = parseOCCSymbol('V250620C00250000');
      expect(result?.ticker).toBe('V');
    });

    it('should return null for invalid length', () => {
      expect(parseOCCSymbol('AAPL')).toBeNull();
      expect(parseOCCSymbol('')).toBeNull();
    });

    it('should be inverse of generateOCCSymbol', () => {
      const original = {
        ticker: 'MSFT',
        strike: 400,
        expirationDate: '2025-12-19',
        optionType: 'put' as const,
      };

      const symbol = generateOCCSymbol(
        original.ticker,
        original.strike,
        original.expirationDate,
        original.optionType
      );

      const parsed = parseOCCSymbol(symbol);
      expect(parsed).toEqual(original);
    });
  });

  describe('formatOptionDisplay', () => {
    it('should format option for display', () => {
      const result = formatOptionDisplay('AAPL', 150, '2025-01-17', 'call');
      expect(result).toBe('AAPL $150 Call 17 Jan 2025');
    });

    it('should format put option correctly', () => {
      const result = formatOptionDisplay('TSLA', 200, '2025-03-21', 'put');
      expect(result).toBe('TSLA $200 Put 21 Mar 2025');
    });
  });

  describe('formatOptionShort', () => {
    it('should format option in short format', () => {
      const result = formatOptionShort(150, '2025-01-17', 'call');
      expect(result).toBe('$150 C 17/1');
    });

    it('should format put in short format', () => {
      const result = formatOptionShort(200, '2025-12-19', 'put');
      expect(result).toBe('$200 P 19/12');
    });
  });

  // ==========================================
  // DTE Functions
  // ==========================================

  describe('calculateDTE', () => {
    it('should calculate positive DTE for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const result = calculateDTE(futureDate);
      expect(result).toBe(10);
    });

    it('should return 0 for today', () => {
      const today = new Date();
      const result = calculateDTE(today);
      expect(result).toBe(0);
    });

    it('should return negative for past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const result = calculateDTE(pastDate);
      expect(result).toBe(-5);
    });

    it('should handle string date input', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split('T')[0];
      const result = calculateDTE(dateStr);
      expect(result).toBe(7);
    });
  });

  describe('getDTECategory', () => {
    it('should return expired for negative DTE', () => {
      expect(getDTECategory(-1)).toBe('expired');
      expect(getDTECategory(-10)).toBe('expired');
    });

    it('should return critical for DTE <= 7', () => {
      expect(getDTECategory(0)).toBe('critical');
      expect(getDTECategory(5)).toBe('critical');
      expect(getDTECategory(7)).toBe('critical');
    });

    it('should return warning for DTE 8-14', () => {
      expect(getDTECategory(8)).toBe('warning');
      expect(getDTECategory(14)).toBe('warning');
    });

    it('should return ok for DTE > 14', () => {
      expect(getDTECategory(15)).toBe('ok');
      expect(getDTECategory(30)).toBe('ok');
    });
  });

  describe('formatDTE', () => {
    it('should format positive DTE', () => {
      expect(formatDTE(5)).toBe('5d');
      expect(formatDTE(30)).toBe('30d');
    });

    it('should return Today for 0', () => {
      expect(formatDTE(0)).toBe('Today');
    });

    it('should return Expired for negative', () => {
      expect(formatDTE(-1)).toBe('Expired');
      expect(formatDTE(-10)).toBe('Expired');
    });
  });

  // ==========================================
  // Value Calculations
  // ==========================================

  describe('calculateOptionValue', () => {
    it('should calculate value with default multiplier', () => {
      // 5 contracts × $2.50 × 100 = $1,250
      expect(calculateOptionValue(5, 2.5)).toBe(1250);
    });

    it('should calculate value with custom multiplier', () => {
      // 5 contracts × $2.50 × 10 = $125
      expect(calculateOptionValue(5, 2.5, 10)).toBe(125);
    });

    it('should handle single contract', () => {
      expect(calculateOptionValue(1, 3.0)).toBe(300);
    });
  });

  describe('calculateOptionPL', () => {
    it('should calculate profit for long position when price increases', () => {
      // Long: bought at $2, now $3, 2 contracts
      // PL = (3 - 2) × 2 × 100 = $200
      const result = calculateOptionPL('long', 2, 2.0, 3.0);
      expect(result).toBe(200);
    });

    it('should calculate loss for long position when price decreases', () => {
      // Long: bought at $3, now $2, 2 contracts
      // PL = (2 - 3) × 2 × 100 = -$200
      const result = calculateOptionPL('long', 2, 3.0, 2.0);
      expect(result).toBe(-200);
    });

    it('should calculate profit for short position when price decreases', () => {
      // Short: sold at $3, now $2, 2 contracts
      // PL = (3 - 2) × 2 × 100 = $200
      const result = calculateOptionPL('short', 2, 3.0, 2.0);
      expect(result).toBe(200);
    });

    it('should calculate loss for short position when price increases', () => {
      // Short: sold at $2, now $3, 2 contracts
      // PL = (2 - 3) × 2 × 100 = -$200
      const result = calculateOptionPL('short', 2, 2.0, 3.0);
      expect(result).toBe(-200);
    });
  });

  describe('calculateOptionPLPercent', () => {
    it('should calculate percentage for long position', () => {
      // Bought at $2, now $3 = +50%
      expect(calculateOptionPLPercent('long', 2.0, 3.0)).toBe(50);
    });

    it('should calculate percentage for short position', () => {
      // Sold at $3, now $2 = +33.33%
      expect(calculateOptionPLPercent('short', 3.0, 2.0)).toBeCloseTo(33.33, 1);
    });

    it('should return 0 when avgPremium is 0', () => {
      expect(calculateOptionPLPercent('long', 0, 3.0)).toBe(0);
    });
  });

  // ==========================================
  // Moneyness Functions
  // ==========================================

  describe('getMoneyness', () => {
    describe('call options', () => {
      it('should return ITM when stock price > strike', () => {
        expect(getMoneyness('call', 160, 150)).toBe('ITM');
      });

      it('should return OTM when stock price < strike', () => {
        expect(getMoneyness('call', 140, 150)).toBe('OTM');
      });

      it('should return ATM when stock price ≈ strike', () => {
        expect(getMoneyness('call', 151, 150)).toBe('ATM');
        expect(getMoneyness('call', 149, 150)).toBe('ATM');
      });
    });

    describe('put options', () => {
      it('should return ITM when stock price < strike', () => {
        expect(getMoneyness('put', 140, 150)).toBe('ITM');
      });

      it('should return OTM when stock price > strike', () => {
        expect(getMoneyness('put', 160, 150)).toBe('OTM');
      });

      it('should return ATM when stock price ≈ strike', () => {
        expect(getMoneyness('put', 151, 150)).toBe('ATM');
      });
    });

    it('should respect custom ATM threshold', () => {
      // With 5% threshold, 145 should be ATM for strike 150
      expect(getMoneyness('call', 145, 150, 5)).toBe('ATM');
      // With default 2%, it should be OTM
      expect(getMoneyness('call', 145, 150)).toBe('OTM');
    });
  });

  describe('getMoneynessLabel', () => {
    it('should return correct labels', () => {
      expect(getMoneynessLabel('ITM')).toBe('In The Money');
      expect(getMoneynessLabel('ATM')).toBe('At The Money');
      expect(getMoneynessLabel('OTM')).toBe('Out of The Money');
    });
  });

  // ==========================================
  // Break-even Calculations
  // ==========================================

  describe('calculateBreakeven', () => {
    it('should calculate break-even for long call', () => {
      // Call strike $150, premium $5 → break-even = $155
      expect(calculateBreakeven('call', 150, 5)).toBe(155);
    });

    it('should calculate break-even for long put', () => {
      // Put strike $150, premium $5 → break-even = $145
      expect(calculateBreakeven('put', 150, 5)).toBe(145);
    });
  });

  // ==========================================
  // Validation Functions
  // ==========================================

  describe('isValidOCCSymbol', () => {
    it('should return true for valid symbols', () => {
      expect(isValidOCCSymbol('AAPL  250117C00150000')).toBe(true);
      expect(isValidOCCSymbol('TSLA  250321P00200000')).toBe(true);
    });

    it('should return false for invalid length', () => {
      expect(isValidOCCSymbol('AAPL')).toBe(false);
      expect(isValidOCCSymbol('')).toBe(false);
    });

    it('should return false for invalid type character', () => {
      expect(isValidOCCSymbol('AAPL  250117X00150000')).toBe(false);
    });

    it('should return false for non-numeric strike', () => {
      expect(isValidOCCSymbol('AAPL  250117C0015ABCD')).toBe(false);
    });
  });
});
