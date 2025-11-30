import { formatCurrency, formatPercent } from '@/utils/format';
import { MetricValue, Muted } from '../Typography';
import { cn } from '@/utils/cn';
import './PriceDisplay.css';

interface PriceDisplayProps {
  price: number | null;
  currency?: string;
  change?: number | null;
  changePercent?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showChange?: boolean;
  inline?: boolean;
}

export function PriceDisplay({
  price,
  currency = 'USD',
  change,
  changePercent,
  size = 'md',
  showChange = true,
  inline = false,
}: PriceDisplayProps) {
  if (price === null) {
    return <Muted>—</Muted>;
  }

  const sentiment: 'positive' | 'negative' | undefined =
    changePercent !== null && changePercent !== undefined
      ? changePercent > 0
        ? 'positive'
        : changePercent < 0
        ? 'negative'
        : undefined
      : undefined;

  const metricSize = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'base';

  return (
    <div
      className={cn(
        'price-display',
        `price-display--${size}`,
        inline && 'price-display--inline'
      )}
    >
      <MetricValue size={metricSize}>
        {formatCurrency(price, currency)}
      </MetricValue>
      {showChange && changePercent !== null && changePercent !== undefined && (
        <span className="price-display-change">
          <MetricValue size="sm" sentiment={sentiment}>
            {change !== null && change !== undefined && (
              <span className="price-display-change-value">
                {change > 0 ? '+' : ''}
                {formatCurrency(change, currency)}
              </span>
            )}
            <span className="price-display-change-percent">
              ({changePercent > 0 ? '+' : ''}
              {formatPercent(changePercent, 2)})
            </span>
          </MetricValue>
        </span>
      )}
    </div>
  );
}
