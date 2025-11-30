import { MetricLabel, MetricValue, Muted } from '../Typography';
import { cn } from '@/utils/cn';
import './ScoreCard.css';

interface ScoreCardProps {
  label: string;
  value: number | null;
  maxValue?: number;
  suffix?: string;
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'auto';
  thresholds?: {
    good: number;
    bad: number;
    higherIsBetter?: boolean;
  };
}

export function ScoreCard({
  label,
  value,
  maxValue = 100,
  suffix = '',
  size = 'md',
  showBar = false,
  sentiment = 'auto',
  thresholds,
}: ScoreCardProps) {
  const getSentiment = (): 'positive' | 'negative' | 'neutral' | undefined => {
    if (value === null) return undefined;
    if (sentiment !== 'auto') return sentiment;
    if (!thresholds) return undefined;

    const { good, bad, higherIsBetter = true } = thresholds;

    if (higherIsBetter) {
      if (value >= good) return 'positive';
      if (value <= bad) return 'negative';
    } else {
      if (value <= good) return 'positive';
      if (value >= bad) return 'negative';
    }
    return 'neutral';
  };

  const valueSentiment = getSentiment();
  const percentage =
    value !== null ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <div className={cn('score-card', `score-card--${size}`)}>
      <MetricLabel>{label}</MetricLabel>
      {value !== null ? (
        <MetricValue
          size={size === 'lg' ? 'lg' : 'base'}
          sentiment={valueSentiment}
        >
          {value.toFixed(0)}
          {suffix}
        </MetricValue>
      ) : (
        <Muted>—</Muted>
      )}
      {showBar && value !== null && (
        <div className="score-card-bar">
          <div
            className={cn('score-card-bar-fill', valueSentiment)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
