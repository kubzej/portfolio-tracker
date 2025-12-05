import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartSection } from './ChartSection';

describe('ChartSection', () => {
  it('renders title', () => {
    render(
      <ChartSection title="Price Chart">
        <div>Chart content</div>
      </ChartSection>
    );
    expect(screen.getByText('Price Chart')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <ChartSection title="Chart">
        <div>Chart content here</div>
      </ChartSection>
    );
    expect(screen.getByText('Chart content here')).toBeInTheDocument();
  });

  it('renders time range selector when provided', () => {
    render(
      <ChartSection title="Chart" timeRange="1M" onTimeRangeChange={vi.fn()}>
        <div>Content</div>
      </ChartSection>
    );
    expect(screen.getByText('1M')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ChartSection title="Chart" className="custom-chart">
        <div>Content</div>
      </ChartSection>
    );
    expect(container.querySelector('.custom-chart')).toBeInTheDocument();
  });
});
