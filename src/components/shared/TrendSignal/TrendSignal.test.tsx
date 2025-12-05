import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendSignal } from './TrendSignal';

describe('TrendSignal', () => {
  it('renders signal text', () => {
    render(
      <TrendSignal signal="BULLISH" description="Upward trend" type="bullish" />
    );
    expect(screen.getByText('BULLISH')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <TrendSignal signal="BULLISH" description="Upward trend" type="bullish" />
    );
    expect(screen.getByText('Upward trend')).toBeInTheDocument();
  });

  it('applies bullish class', () => {
    const { container } = render(
      <TrendSignal signal="BULLISH" description="Test" type="bullish" />
    );
    expect(
      container.querySelector('.trend-signal-box.bullish')
    ).toBeInTheDocument();
  });

  it('applies bearish class', () => {
    const { container } = render(
      <TrendSignal signal="BEARISH" description="Test" type="bearish" />
    );
    expect(
      container.querySelector('.trend-signal-box.bearish')
    ).toBeInTheDocument();
  });

  it('applies neutral class', () => {
    const { container } = render(
      <TrendSignal signal="NEUTRAL" description="Test" type="neutral" />
    );
    expect(
      container.querySelector('.trend-signal-box.neutral')
    ).toBeInTheDocument();
  });
});
