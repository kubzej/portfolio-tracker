import { formatCurrency, formatPercent } from '@/utils/format';
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
    return <span className="price-display price-display--empty">—</span>;
  }

  const changeClass =
    changePercent !== null && changePercent !== undefined
      ? changePercent > 0
        ? 'positive'
        : changePercent < 0
        ? 'negative'
        : ''
      : '';

  const containerClass = `price-display price-display--${size} ${
    inline ? 'price-display--inline' : ''
  }`;

  return (
    <div className={containerClass}>
      <span className="price-display-value">
        {formatCurrency(price, currency)}
      </span>
      {showChange && changePercent !== null && changePercent !== undefined && (
        <span className={`price-display-change ${changeClass}`}>
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
        </span>
      )}
    </div>
  );
}
