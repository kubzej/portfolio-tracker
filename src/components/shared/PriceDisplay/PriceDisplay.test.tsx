import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceDisplay } from './PriceDisplay';

describe('PriceDisplay', () => {
  it('renders price', () => {
    render(<PriceDisplay price={100} />);
    // Locale-dependent format (e.g., "100,00 US$" or "$100.00")
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('renders dash for null price', () => {
    render(<PriceDisplay price={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders with currency', () => {
    render(<PriceDisplay price={100} currency="EUR" />);
    // Locale-dependent format (e.g., "100,00 €" or "€100.00")
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('renders change percent when provided', () => {
    render(<PriceDisplay price={100} changePercent={5.5} showChange />);
    // Locale-dependent format (e.g., "5,50%" or "5.50%")
    expect(screen.getByText(/5[,.]50/)).toBeInTheDocument();
  });

  it('applies size class', () => {
    const { container } = render(<PriceDisplay price={100} size="lg" />);
    expect(container.querySelector('.price-display--lg')).toBeInTheDocument();
  });

  it('applies inline class', () => {
    const { container } = render(<PriceDisplay price={100} inline />);
    expect(
      container.querySelector('.price-display--inline')
    ).toBeInTheDocument();
  });
});
