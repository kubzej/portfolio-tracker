import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockCard } from './StockCard';

describe('StockCard', () => {
  it('renders ticker', () => {
    render(<StockCard ticker="AAPL" name="Apple Inc." currency="USD" />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
  });

  it('renders company name', () => {
    render(<StockCard ticker="AAPL" name="Apple Inc." currency="USD" />);
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
  });

  it('renders sector when provided', () => {
    render(
      <StockCard
        ticker="AAPL"
        name="Apple"
        currency="USD"
        sectorName="Technology"
      />
    );
    expect(screen.getByText('Technology')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <StockCard ticker="AAPL" name="Apple" currency="USD" onClick={onClick} />
    );
    container.querySelector('.stock-card')?.click();
    expect(onClick).toHaveBeenCalled();
  });
});
