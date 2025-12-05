import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  describe('rendering', () => {
    it('renders label', () => {
      render(<MetricCard label="P/E Ratio" value={15} />);
      expect(screen.getByText('P/E Ratio')).toBeInTheDocument();
    });

    it('renders numeric value', () => {
      render(<MetricCard label="Price" value={123.45} />);
      expect(screen.getByText('123.45')).toBeInTheDocument();
    });

    it('renders string value', () => {
      render(<MetricCard label="Status" value="Active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders container with metric-card class', () => {
      const { container } = render(<MetricCard label="Test" value={10} />);
      expect(container.querySelector('.metric-card')).toBeInTheDocument();
    });
  });

  describe('null/undefined values', () => {
    it('renders dash for null value', () => {
      render(<MetricCard label="Test" value={null} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders dash for undefined value', () => {
      render(<MetricCard label="Test" value={undefined as unknown as null} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('suffix', () => {
    it('renders suffix after value', () => {
      render(<MetricCard label="Change" value={5.5} suffix="%" />);
      expect(screen.getByText(/5\.5%/)).toBeInTheDocument();
    });

    it('renders x suffix for multiples', () => {
      render(<MetricCard label="P/E" value={15} suffix="x" />);
      expect(screen.getByText(/15x/)).toBeInTheDocument();
    });
  });

  describe('subValue', () => {
    it('renders subValue with slash separator', () => {
      render(<MetricCard label="Score" value={75} subValue={100} />);
      expect(screen.getByText('/ 100')).toBeInTheDocument();
    });

    it('renders string subValue', () => {
      render(<MetricCard label="Rating" value="A" subValue="AAA" />);
      expect(screen.getByText('/ AAA')).toBeInTheDocument();
    });
  });

  describe('subtext', () => {
    it('renders custom subtext', () => {
      render(<MetricCard label="Analysts" value={15} subtext="analysts" />);
      expect(screen.getByText('analysts')).toBeInTheDocument();
    });

    it('prefers subtext over subValue', () => {
      render(
        <MetricCard
          label="Score"
          value={75}
          subValue={100}
          subtext="out of 100"
        />
      );
      expect(screen.getByText('out of 100')).toBeInTheDocument();
      expect(screen.queryByText('/ 100')).not.toBeInTheDocument();
    });
  });

  describe('sentiment', () => {
    it('applies positive sentiment', () => {
      const { container } = render(
        <MetricCard label="Change" value={5} sentiment="positive" />
      );
      expect(
        container.querySelector('.metric-value--positive')
      ).toBeInTheDocument();
    });

    it('applies negative sentiment', () => {
      const { container } = render(
        <MetricCard label="Change" value={-5} sentiment="negative" />
      );
      expect(
        container.querySelector('.metric-value--negative')
      ).toBeInTheDocument();
    });

    it('applies neutral sentiment', () => {
      const { container } = render(
        <MetricCard label="Change" value={0} sentiment="neutral" />
      );
      expect(
        container.querySelector('.metric-value--neutral')
      ).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      const { container } = render(<MetricCard label="Test" value={10} />);
      expect(container.querySelector('.metric-card--md')).toBeInTheDocument();
    });

    it('applies small size', () => {
      const { container } = render(
        <MetricCard label="Test" value={10} size="sm" />
      );
      expect(container.querySelector('.metric-card--sm')).toBeInTheDocument();
    });

    it('applies large size', () => {
      const { container } = render(
        <MetricCard label="Test" value={10} size="lg" />
      );
      expect(container.querySelector('.metric-card--lg')).toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    it('renders tooltip element when provided', () => {
      render(
        <MetricCard
          label="P/E"
          value={15}
          tooltip={<span data-testid="tooltip">Info</span>}
        />
      );
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });
  });

  describe('number formatting', () => {
    it('formats large numbers with locale', () => {
      render(<MetricCard label="Market Cap" value={1000000} />);
      // Number formatting depends on locale, but should contain the number
      expect(screen.getByText(/1.*000.*000/)).toBeInTheDocument();
    });

    it('renders 0 as value (not as null)', () => {
      render(<MetricCard label="Change" value={0} />);
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.queryByText('—')).not.toBeInTheDocument();
    });
  });
});
