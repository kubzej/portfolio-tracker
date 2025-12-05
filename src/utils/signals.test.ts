/**
 * Tests for signals.ts utility functions
 */

import { describe, it, expect } from 'vitest';
import { SIGNAL_CONFIG, getSignalConfig } from './signals';
import type { SignalType } from './recommendations';

describe('SIGNAL_CONFIG', () => {
  it('should have configuration for all action signals', () => {
    const actionSignals: SignalType[] = [
      'DIP_OPPORTUNITY',
      'BREAKOUT',
      'REVERSAL',
      'MOMENTUM',
      'ACCUMULATE',
      'GOOD_ENTRY',
      'WAIT_FOR_DIP',
      'NEAR_TARGET',
      'TAKE_PROFIT',
      'TRIM',
      'WATCH',
      'HOLD',
    ];

    actionSignals.forEach((signal) => {
      expect(SIGNAL_CONFIG[signal]).toBeDefined();
      expect(SIGNAL_CONFIG[signal].label).toBeDefined();
      expect(SIGNAL_CONFIG[signal].class).toBeDefined();
      expect(SIGNAL_CONFIG[signal].description).toBeDefined();
    });
  });

  it('should have configuration for all quality signals', () => {
    const qualitySignals: SignalType[] = [
      'CONVICTION',
      'QUALITY_CORE',
      'UNDERVALUED',
      'STRONG_TREND',
      'STEADY',
      'FUNDAMENTALLY_WEAK',
      'TECHNICALLY_WEAK',
      'PROBLEMATIC',
      'WEAK',
      'OVERBOUGHT',
      'NEUTRAL',
    ];

    qualitySignals.forEach((signal) => {
      expect(SIGNAL_CONFIG[signal]).toBeDefined();
      expect(SIGNAL_CONFIG[signal].label).toBeDefined();
      expect(SIGNAL_CONFIG[signal].class).toBeDefined();
      expect(SIGNAL_CONFIG[signal].description).toBeDefined();
    });
  });

  it('should have non-empty labels for all signals', () => {
    Object.values(SIGNAL_CONFIG).forEach((config) => {
      expect(config.label.length).toBeGreaterThan(0);
    });
  });

  it('should have non-empty descriptions for all signals', () => {
    Object.values(SIGNAL_CONFIG).forEach((config) => {
      expect(config.description.length).toBeGreaterThan(0);
    });
  });
});

describe('getSignalConfig', () => {
  it('should return correct config for DIP_OPPORTUNITY', () => {
    const config = getSignalConfig('DIP_OPPORTUNITY');
    expect(config.label).toBe('Koupit dip');
    expect(config.class).toBe('dip');
  });

  it('should return correct config for CONVICTION', () => {
    const config = getSignalConfig('CONVICTION');
    expect(config.label).toBe('Nejvyšší kvalita');
    expect(config.class).toBe('conviction');
  });

  it('should return correct config for HOLD', () => {
    const config = getSignalConfig('HOLD');
    expect(config.label).toBe('Držet');
    expect(config.class).toBe('hold');
  });

  it('should return NEUTRAL config for unknown signal type', () => {
    // @ts-expect-error - testing unknown signal type
    const config = getSignalConfig('UNKNOWN_SIGNAL');
    expect(config.label).toBe('Neutrální');
  });
});
