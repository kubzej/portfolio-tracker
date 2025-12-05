/**
 * Tests for Badge Typography component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { Badge } from './Badge';

describe('Badge', () => {
  it('should render children', () => {
    render(<Badge variant="info">Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('should apply variant class', () => {
    render(<Badge variant="buy">Buy</Badge>);
    expect(screen.getByText('Buy')).toHaveClass('badge--buy');
  });

  it('should apply size class', () => {
    const { rerender } = render(
      <Badge variant="info" size="xs">
        XS
      </Badge>
    );
    expect(screen.getByText('XS')).toHaveClass('badge--xs');

    rerender(
      <Badge variant="info" size="sm">
        SM
      </Badge>
    );
    expect(screen.getByText('SM')).toHaveClass('badge--sm');

    rerender(
      <Badge variant="info" size="lg">
        LG
      </Badge>
    );
    expect(screen.getByText('LG')).toHaveClass('badge--lg');
  });

  it('should use base size by default', () => {
    render(<Badge variant="info">Default</Badge>);
    expect(screen.getByText('Default')).toHaveClass('badge--base');
  });

  it('should apply title attribute when provided', () => {
    render(
      <Badge variant="info" title="Tooltip text">
        With Title
      </Badge>
    );
    expect(screen.getByText('With Title')).toHaveAttribute(
      'title',
      'Tooltip text'
    );
  });

  it('should render recommendation variants', () => {
    const { rerender } = render(<Badge variant="buy">Buy</Badge>);
    expect(screen.getByText('Buy')).toHaveClass('badge--buy');

    rerender(<Badge variant="sell">Sell</Badge>);
    expect(screen.getByText('Sell')).toHaveClass('badge--sell');

    rerender(<Badge variant="hold">Hold</Badge>);
    expect(screen.getByText('Hold')).toHaveClass('badge--hold');
  });

  it('should render sentiment variants', () => {
    const { rerender } = render(<Badge variant="positive">Positive</Badge>);
    expect(screen.getByText('Positive')).toHaveClass('badge--positive');

    rerender(<Badge variant="negative">Negative</Badge>);
    expect(screen.getByText('Negative')).toHaveClass('badge--negative');

    rerender(<Badge variant="neutral">Neutral</Badge>);
    expect(screen.getByText('Neutral')).toHaveClass('badge--neutral');
  });

  it('should render action signal variants', () => {
    const { rerender } = render(<Badge variant="dip">Dip</Badge>);
    expect(screen.getByText('Dip')).toHaveClass('badge--dip');

    rerender(<Badge variant="breakout">Breakout</Badge>);
    expect(screen.getByText('Breakout')).toHaveClass('badge--breakout');

    rerender(<Badge variant="momentum">Momentum</Badge>);
    expect(screen.getByText('Momentum')).toHaveClass('badge--momentum');
  });

  it('should render quality signal variants', () => {
    const { rerender } = render(<Badge variant="conviction">Conviction</Badge>);
    expect(screen.getByText('Conviction')).toHaveClass('badge--conviction');

    rerender(<Badge variant="quality">Quality</Badge>);
    expect(screen.getByText('Quality')).toHaveClass('badge--quality');

    rerender(<Badge variant="steady">Steady</Badge>);
    expect(screen.getByText('Steady')).toHaveClass('badge--steady');
  });

  it('should combine base class with variant and size', () => {
    render(
      <Badge variant="warning" size="lg">
        Combined
      </Badge>
    );
    const badge = screen.getByText('Combined');
    expect(badge).toHaveClass('badge', 'badge--lg', 'badge--warning');
  });
});
