import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreCard } from './ScoreCard';

describe('ScoreCard', () => {
  describe('rendering', () => {
    it('renders label', () => {
      render(<ScoreCard label="Fundamental" value={75} />);
      expect(screen.getByText('Fundamental')).toBeInTheDocument();
    });

    it('renders value', () => {
      render(<ScoreCard label="Score" value={85} />);
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('renders container with score-card class', () => {
      const { container } = render(<ScoreCard label="Test" value={50} />);
      expect(container.querySelector('.score-card')).toBeInTheDocument();
    });

    it('formats value as integer', () => {
      render(<ScoreCard label="Score" value={75.7} />);
      expect(screen.getByText('76')).toBeInTheDocument();
    });
  });

  describe('null values', () => {
    it('renders dash for null value', () => {
      render(<ScoreCard label="Score" value={null} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('suffix', () => {
    it('renders suffix after value', () => {
      render(<ScoreCard label="Score" value={75} suffix="%" />);
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('renders without suffix by default', () => {
      render(<ScoreCard label="Score" value={75} />);
      expect(screen.getByText('75')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      const { container } = render(<ScoreCard label="Test" value={50} />);
      expect(container.querySelector('.score-card--md')).toBeInTheDocument();
    });

    it('applies small size', () => {
      const { container } = render(
        <ScoreCard label="Test" value={50} size="sm" />
      );
      expect(container.querySelector('.score-card--sm')).toBeInTheDocument();
    });

    it('applies large size', () => {
      const { container } = render(
        <ScoreCard label="Test" value={50} size="lg" />
      );
      expect(container.querySelector('.score-card--lg')).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('does not render bar by default', () => {
      const { container } = render(<ScoreCard label="Score" value={75} />);
      expect(
        container.querySelector('.score-card-bar')
      ).not.toBeInTheDocument();
    });

    it('renders bar when showBar is true', () => {
      const { container } = render(
        <ScoreCard label="Score" value={75} showBar />
      );
      expect(container.querySelector('.score-card-bar')).toBeInTheDocument();
    });

    it('sets bar width based on value and maxValue', () => {
      const { container } = render(
        <ScoreCard label="Score" value={50} maxValue={100} showBar />
      );
      const barFill = container.querySelector('.score-card-bar-fill');
      expect(barFill).toHaveStyle({ width: '50%' });
    });

    it('caps bar width at 100%', () => {
      const { container } = render(
        <ScoreCard label="Score" value={150} maxValue={100} showBar />
      );
      const barFill = container.querySelector('.score-card-bar-fill');
      expect(barFill).toHaveStyle({ width: '100%' });
    });

    it('does not render bar for null value', () => {
      const { container } = render(
        <ScoreCard label="Score" value={null} showBar />
      );
      expect(
        container.querySelector('.score-card-bar')
      ).not.toBeInTheDocument();
    });
  });

  describe('sentiment', () => {
    it('applies explicit positive sentiment', () => {
      const { container } = render(
        <ScoreCard label="Score" value={50} sentiment="positive" />
      );
      expect(
        container.querySelector('.metric-value--positive')
      ).toBeInTheDocument();
    });

    it('applies explicit negative sentiment', () => {
      const { container } = render(
        <ScoreCard label="Score" value={50} sentiment="negative" />
      );
      expect(
        container.querySelector('.metric-value--negative')
      ).toBeInTheDocument();
    });

    it('applies explicit neutral sentiment', () => {
      const { container } = render(
        <ScoreCard label="Score" value={50} sentiment="neutral" />
      );
      expect(
        container.querySelector('.metric-value--neutral')
      ).toBeInTheDocument();
    });
  });

  describe('auto sentiment with thresholds', () => {
    const thresholds = { good: 70, bad: 30, higherIsBetter: true };

    it('applies positive sentiment for high values', () => {
      const { container } = render(
        <ScoreCard label="Score" value={80} thresholds={thresholds} />
      );
      expect(
        container.querySelector('.metric-value--positive')
      ).toBeInTheDocument();
    });

    it('applies negative sentiment for low values', () => {
      const { container } = render(
        <ScoreCard label="Score" value={20} thresholds={thresholds} />
      );
      expect(
        container.querySelector('.metric-value--negative')
      ).toBeInTheDocument();
    });

    it('applies neutral sentiment for mid values', () => {
      const { container } = render(
        <ScoreCard label="Score" value={50} thresholds={thresholds} />
      );
      expect(
        container.querySelector('.metric-value--neutral')
      ).toBeInTheDocument();
    });

    it('inverts thresholds when higherIsBetter is false', () => {
      const invertedThresholds = { good: 30, bad: 70, higherIsBetter: false };
      const { container } = render(
        <ScoreCard label="P/E" value={25} thresholds={invertedThresholds} />
      );
      expect(
        container.querySelector('.metric-value--positive')
      ).toBeInTheDocument();
    });
  });

  describe('maxValue', () => {
    it('uses 100 as default maxValue', () => {
      const { container } = render(
        <ScoreCard label="Score" value={50} showBar />
      );
      const barFill = container.querySelector('.score-card-bar-fill');
      expect(barFill).toHaveStyle({ width: '50%' });
    });

    it('respects custom maxValue for bar width', () => {
      const { container } = render(
        <ScoreCard label="Score" value={50} maxValue={200} showBar />
      );
      const barFill = container.querySelector('.score-card-bar-fill');
      expect(barFill).toHaveStyle({ width: '25%' });
    });
  });
});
