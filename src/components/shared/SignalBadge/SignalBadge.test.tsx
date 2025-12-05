/**
 * Tests for SignalBadge component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { SignalBadge } from './SignalBadge';

describe('SignalBadge', () => {
  it('should render DIP_OPPORTUNITY signal', () => {
    render(<SignalBadge type="DIP_OPPORTUNITY" />);
    expect(screen.getByText('Koupit dip')).toBeInTheDocument();
  });

  it('should render CONVICTION signal', () => {
    render(<SignalBadge type="CONVICTION" />);
    expect(screen.getByText('Nejvyšší kvalita')).toBeInTheDocument();
  });

  it('should render HOLD signal', () => {
    render(<SignalBadge type="HOLD" />);
    expect(screen.getByText('Držet')).toBeInTheDocument();
  });

  it('should render NEUTRAL signal', () => {
    render(<SignalBadge type="NEUTRAL" />);
    expect(screen.getByText('Neutrální')).toBeInTheDocument();
  });

  it('should render with small size', () => {
    render(<SignalBadge type="MOMENTUM" size="sm" />);
    const badge = screen.getByText('Jet s trendem');
    expect(badge).toHaveClass('badge--xs');
  });

  it('should render with medium size (default)', () => {
    render(<SignalBadge type="MOMENTUM" size="md" />);
    const badge = screen.getByText('Jet s trendem');
    expect(badge).toHaveClass('badge--sm');
  });

  it('should show tooltip when showTooltip is true', () => {
    render(<SignalBadge type="DIP_OPPORTUNITY" showTooltip />);
    const badge = screen.getByText('Koupit dip');
    expect(badge).toHaveAttribute('title');
    expect(badge.getAttribute('title')).toContain('Přeprodáno');
  });

  it('should not show tooltip when showTooltip is false', () => {
    render(<SignalBadge type="DIP_OPPORTUNITY" showTooltip={false} />);
    const badge = screen.getByText('Koupit dip');
    expect(badge).not.toHaveAttribute('title');
  });

  it('should render action signals correctly', () => {
    const actionSignals = [
      { type: 'BREAKOUT' as const, label: 'Nakoupit průlom' },
      { type: 'REVERSAL' as const, label: 'Chytat obrat' },
      { type: 'ACCUMULATE' as const, label: 'Akumulovat' },
      { type: 'WAIT_FOR_DIP' as const, label: 'Počkat na pokles' },
      { type: 'TAKE_PROFIT' as const, label: 'Vybrat zisk' },
      { type: 'TRIM' as const, label: 'Redukovat' },
    ];

    actionSignals.forEach(({ type, label }) => {
      const { unmount } = render(<SignalBadge type={type} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it('should render quality signals correctly', () => {
    const qualitySignals = [
      { type: 'QUALITY_CORE' as const, label: 'Kvalitní' },
      { type: 'UNDERVALUED' as const, label: 'Podhodnocená' },
      { type: 'STRONG_TREND' as const, label: 'Silný trend' },
      { type: 'STEADY' as const, label: 'Stabilní' },
      { type: 'FUNDAMENTALLY_WEAK' as const, label: 'Slabé fundamenty' },
      { type: 'TECHNICALLY_WEAK' as const, label: 'Slabá technika' },
      { type: 'PROBLEMATIC' as const, label: 'Problémová' },
      { type: 'OVERBOUGHT' as const, label: 'Překoupená' },
    ];

    qualitySignals.forEach(({ type, label }) => {
      const { unmount } = render(<SignalBadge type={type} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });
});
