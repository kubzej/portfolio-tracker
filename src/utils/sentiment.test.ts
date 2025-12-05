/**
 * Tests for sentiment.ts utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  getSentimentColor,
  getSentimentLabel,
  getSentimentClass,
} from './sentiment';

describe('getSentimentColor', () => {
  it('should return green for positive sentiment (> 0.2)', () => {
    expect(getSentimentColor(0.5)).toBe('#22c55e');
    expect(getSentimentColor(0.3)).toBe('#22c55e');
    expect(getSentimentColor(1)).toBe('#22c55e');
  });

  it('should return red for negative sentiment (< -0.2)', () => {
    expect(getSentimentColor(-0.5)).toBe('#ef4444');
    expect(getSentimentColor(-0.3)).toBe('#ef4444');
    expect(getSentimentColor(-1)).toBe('#ef4444');
  });

  it('should return yellow for neutral sentiment (-0.2 to 0.2)', () => {
    expect(getSentimentColor(0)).toBe('#f59e0b');
    expect(getSentimentColor(0.1)).toBe('#f59e0b');
    expect(getSentimentColor(-0.1)).toBe('#f59e0b');
    expect(getSentimentColor(0.2)).toBe('#f59e0b');
    expect(getSentimentColor(-0.2)).toBe('#f59e0b');
  });

  it('should return secondary color for null', () => {
    expect(getSentimentColor(null)).toBe('var(--text-secondary)');
  });
});

describe('getSentimentLabel', () => {
  it('should return "Positive" for positive label', () => {
    expect(getSentimentLabel('positive')).toBe('Positive');
  });

  it('should return "Negative" for negative label', () => {
    expect(getSentimentLabel('negative')).toBe('Negative');
  });

  it('should return "Neutral" for neutral label', () => {
    expect(getSentimentLabel('neutral')).toBe('Neutral');
  });

  it('should return "Unknown" for null', () => {
    expect(getSentimentLabel(null)).toBe('Unknown');
  });
});

describe('getSentimentClass', () => {
  it('should return "positive" for positive label', () => {
    expect(getSentimentClass('positive')).toBe('positive');
  });

  it('should return "negative" for negative label', () => {
    expect(getSentimentClass('negative')).toBe('negative');
  });

  it('should return "neutral" for neutral label', () => {
    expect(getSentimentClass('neutral')).toBe('neutral');
  });

  it('should return empty string for null', () => {
    expect(getSentimentClass(null)).toBe('');
  });
});
