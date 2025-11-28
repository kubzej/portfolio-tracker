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
  const getSentimentClass = (): string => {
    if (value === null) return '';
    if (sentiment !== 'auto') return sentiment;
    if (!thresholds) return '';

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

  const sentimentClass = getSentimentClass();
  const percentage = value !== null ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <div className={`score-card score-card--${size}`}>
      <span className="score-card-label">{label}</span>
      <span className={`score-card-value ${sentimentClass}`}>
        {value !== null ? `${value.toFixed(0)}${suffix}` : '—'}
      </span>
      {showBar && value !== null && (
        <div className="score-card-bar">
          <div
            className={`score-card-bar-fill ${sentimentClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
