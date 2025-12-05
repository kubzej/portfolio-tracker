import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndicatorValue } from './IndicatorValue';

describe('IndicatorValue', () => {
  it('renders label', () => {
    render(<IndicatorValue label="RSI" value={65} />);
    expect(screen.getByText('RSI')).toBeInTheDocument();
  });

  it('renders numeric value', () => {
    render(<IndicatorValue label="RSI" value={65} />);
    expect(screen.getByText('65')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<IndicatorValue label="Trend" value="Bullish" />);
    expect(screen.getByText('Bullish')).toBeInTheDocument();
  });

  it('renders dash for null value', () => {
    render(<IndicatorValue label="RSI" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders suffix when provided', () => {
    render(<IndicatorValue label="Change" value={5} suffix="%" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders container with correct class', () => {
    const { container } = render(<IndicatorValue label="Test" value={10} />);
    expect(
      container.querySelector('.indicator-value-item')
    ).toBeInTheDocument();
  });
});
