import {
  Ticker,
  StockName,
  Tag,
  Text,
  Muted,
} from '@/components/shared/Typography';
import { formatPrice, getMarketStatus } from '@/utils/format';
import './StockCard.css';

interface StockCardProps {
  ticker: string;
  name: string;
  exchange?: string | null;
  currency: string;
  sectorName?: string | null;
  targetPrice?: number | null;
  onClick?: () => void;
}

export function StockCard({
  ticker,
  name,
  exchange,
  currency,
  sectorName,
  targetPrice,
  onClick,
}: StockCardProps) {
  const marketStatus = getMarketStatus(ticker);

  return (
    <div className="stock-card" onClick={onClick}>
      <div className="stock-card__header">
        <Ticker size="lg">{ticker}</Ticker>
        <div className="stock-card__badges">
          <Tag
            variant={marketStatus.isOpen ? 'success' : 'muted'}
            size="xs"
            title={`${marketStatus.localTime} local • ${
              marketStatus.nextChange || ''
            }`}
          >
            {marketStatus.isOpen ? 'Otevřeno' : marketStatus.statusText}
          </Tag>
          {exchange && <Tag size="xs">{exchange}</Tag>}
        </div>
      </div>

      <StockName size="base" truncate>
        {name}
      </StockName>

      <div className="stock-card__meta">
        <Muted>{sectorName || 'Žádný sektor'}</Muted>
        <Tag size="xs">{currency}</Tag>
      </div>

      {targetPrice && (
        <div className="stock-card__target">
          <Text size="sm" weight="medium" color="success">
            Cílová cena: {formatPrice(targetPrice, currency)}
          </Text>
        </div>
      )}
    </div>
  );
}
