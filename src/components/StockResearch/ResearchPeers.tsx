import { useState, useEffect } from 'react';
import {
  fetchPeersData,
  type PeerData,
  type PeersResult,
} from '@/services/api/peers';
import { formatNumber, formatPercent, formatLargeNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { LoadingSpinner, ErrorState, InfoTooltip } from '@/components/shared';
import './ResearchPeers.css';

interface ResearchPeersProps {
  ticker: string;
  peers?: string[];
}

type MetricKey =
  | 'peRatio'
  | 'pbRatio'
  | 'evEbitda'
  | 'roe'
  | 'netMargin'
  | 'revenueGrowth'
  | 'targetUpside'
  | 'marketCap';

interface MetricConfig {
  key: MetricKey;
  label: string;
  tooltip: string;
  format: (value: number | null) => string;
  higherIsBetter: boolean;
  /** For valuation metrics, lower is better only if positive */
  lowerIsBetterIfPositive?: boolean;
}

const METRICS: MetricConfig[] = [
  {
    key: 'peRatio',
    label: 'P/E',
    tooltip:
      'Price-to-Earnings ratio. Nižší = levnější valuace (pokud je zisková).',
    format: (v) => (v !== null ? formatNumber(v, 1) : '—'),
    higherIsBetter: false,
    lowerIsBetterIfPositive: true,
  },
  {
    key: 'evEbitda',
    label: 'EV/EBITDA',
    tooltip: 'Enterprise Value to EBITDA. Nižší = levnější valuace.',
    format: (v) => (v !== null ? formatNumber(v, 1) : '—'),
    higherIsBetter: false,
    lowerIsBetterIfPositive: true,
  },
  {
    key: 'roe',
    label: 'ROE',
    tooltip:
      'Return on Equity - rentabilita vlastního kapitálu. Vyšší = lepší.',
    format: (v) => (v !== null ? formatPercent(v) : '—'),
    higherIsBetter: true,
  },
  {
    key: 'netMargin',
    label: 'Margin',
    tooltip: 'Čistá zisková marže. Vyšší = vyšší profitabilita.',
    format: (v) => (v !== null ? formatPercent(v) : '—'),
    higherIsBetter: true,
  },
  {
    key: 'revenueGrowth',
    label: 'Rev Growth',
    tooltip: 'Meziroční růst tržeb. Vyšší = rychlejší růst.',
    format: (v) => (v !== null ? formatPercent(v) : '—'),
    higherIsBetter: true,
  },
  {
    key: 'targetUpside',
    label: 'Upside',
    tooltip: 'Potenciální růst k cílovému kurzu analytiků.',
    format: (v) =>
      v !== null ? `${v > 0 ? '+' : ''}${formatNumber(v, 1)}%` : '—',
    higherIsBetter: true,
  },
  {
    key: 'marketCap',
    label: 'Market Cap',
    tooltip: 'Tržní kapitalizace společnosti.',
    format: (v) => (v !== null ? formatLargeNumber(v) : '—'),
    higherIsBetter: false, // Neutral, but we don't highlight
  },
];

function getRanking(
  allStocks: PeerData[],
  metricKey: MetricKey,
  higherIsBetter: boolean,
  lowerIsBetterIfPositive?: boolean
): Map<string, 'best' | 'worst' | null> {
  const rankings = new Map<string, 'best' | 'worst' | null>();

  // Get valid values
  const validStocks = allStocks.filter((s) => {
    const val = s[metricKey];
    return val !== null && val !== undefined && !isNaN(val as number);
  });

  if (validStocks.length < 2) {
    allStocks.forEach((s) => rankings.set(s.ticker, null));
    return rankings;
  }

  const values = validStocks.map((s) => ({
    ticker: s.ticker,
    value: s[metricKey] as number,
  }));

  // Sort values
  values.sort((a, b) => {
    if (lowerIsBetterIfPositive) {
      // For P/E, EV/EBITDA: lower positive values are better, negative values are bad
      const aPositive = a.value > 0;
      const bPositive = b.value > 0;
      if (aPositive && !bPositive) return -1;
      if (!aPositive && bPositive) return 1;
      if (aPositive && bPositive) return a.value - b.value; // Lower is better
      return b.value - a.value; // Both negative, less negative is better
    }
    return higherIsBetter ? b.value - a.value : a.value - b.value;
  });

  // Set rankings
  allStocks.forEach((s) => rankings.set(s.ticker, null));

  if (values.length >= 1) {
    rankings.set(values[0].ticker, 'best');
  }
  if (values.length >= 2) {
    rankings.set(values[values.length - 1].ticker, 'worst');
  }

  return rankings;
}

export function ResearchPeers({ ticker, peers }: ResearchPeersProps) {
  const [data, setData] = useState<PeersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchPeersData(ticker, peers);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load peers data'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [ticker, peers]);

  if (loading) {
    return <LoadingSpinner text="Loading peers data..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Failed to load data'} />;
  }

  const allStocks = [data.mainStock, ...data.peers];

  // If no peers found
  if (data.peers.length === 0) {
    return (
      <div className="peers-empty">
        <p>No peer data available for this ticker.</p>
      </div>
    );
  }

  // Calculate rankings for each metric
  const rankings = METRICS.map((metric) =>
    getRanking(
      allStocks,
      metric.key,
      metric.higherIsBetter,
      metric.lowerIsBetterIfPositive
    )
  );

  return (
    <div className="research-peers">
      <div className="peers-header">
        <h3>Peer Comparison</h3>
        <p className="peers-subtitle">
          Key metrics compared with {data.peers.length} competitors
        </p>
      </div>

      <div className="peers-table-wrapper">
        <table className="peers-table">
          <thead>
            <tr>
              <th className="metric-col">Metric</th>
              {allStocks.map((stock) => (
                <th
                  key={stock.ticker}
                  className={cn(
                    'stock-col',
                    stock.ticker === ticker && 'current'
                  )}
                >
                  <span className="stock-ticker">{stock.ticker}</span>
                  {stock.name && (
                    <span className="stock-name">{stock.name}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Price row */}
            <tr className="price-row">
              <td className="metric-col">
                <span className="metric-label">Price</span>
              </td>
              {allStocks.map((stock) => (
                <td
                  key={stock.ticker}
                  className={cn(
                    'stock-col',
                    stock.ticker === ticker && 'current'
                  )}
                >
                  <div className="price-cell">
                    <span className="price-value">
                      {stock.currentPrice !== null
                        ? `$${formatNumber(stock.currentPrice, 2)}`
                        : '—'}
                    </span>
                    {stock.priceChangePercent !== null && (
                      <span
                        className={cn(
                          'price-change',
                          stock.priceChangePercent >= 0
                            ? 'positive'
                            : 'negative'
                        )}
                      >
                        {stock.priceChangePercent >= 0 ? '+' : ''}
                        {formatNumber(stock.priceChangePercent, 2)}%
                      </span>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Recommendation row */}
            <tr>
              <td className="metric-col">
                <span className="metric-label">
                  Recommendation
                  <InfoTooltip text="Konsenzus analytiků na základě průzkumu." />
                </span>
              </td>
              {allStocks.map((stock) => (
                <td
                  key={stock.ticker}
                  className={cn(
                    'stock-col',
                    stock.ticker === ticker && 'current'
                  )}
                >
                  <span
                    className={cn(
                      'recommendation-badge',
                      stock.consensusScore !== null &&
                        (stock.consensusScore > 0.5
                          ? 'positive'
                          : stock.consensusScore < -0.5
                          ? 'negative'
                          : 'neutral')
                    )}
                  >
                    {stock.recommendationKey?.toUpperCase().replace('_', ' ') ??
                      '—'}
                  </span>
                </td>
              ))}
            </tr>

            {/* Metric rows */}
            {METRICS.map((metric, idx) => (
              <tr key={metric.key}>
                <td className="metric-col">
                  <span className="metric-label">
                    {metric.label}
                    <InfoTooltip text={metric.tooltip} />
                  </span>
                </td>
                {allStocks.map((stock) => {
                  const value = stock[metric.key];
                  const rank = rankings[idx].get(stock.ticker);
                  return (
                    <td
                      key={stock.ticker}
                      className={cn(
                        'stock-col',
                        stock.ticker === ticker && 'current',
                        rank === 'best' && 'best',
                        rank === 'worst' && 'worst'
                      )}
                    >
                      <span className="metric-value">
                        {metric.format(value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="peers-cards">
        {allStocks.map((stock) => {
          const isCurrent = stock.ticker === ticker;
          // Get key metrics for cards (subset of METRICS)
          const cardMetrics = METRICS.filter((m) =>
            [
              'peRatio',
              'roe',
              'revenueGrowth',
              'targetUpside',
              'netMargin',
              'evEbitda',
            ].includes(m.key)
          );

          return (
            <div
              key={stock.ticker}
              className={cn('peer-card', isCurrent && 'current')}
            >
              <div className="peer-card-header">
                <div className="peer-card-title">
                  <span className="peer-card-ticker">{stock.ticker}</span>
                  {stock.name && (
                    <span className="peer-card-name">{stock.name}</span>
                  )}
                </div>
                <div className="peer-card-price">
                  <span className="peer-card-price-value">
                    {stock.currentPrice !== null
                      ? `$${formatNumber(stock.currentPrice, 2)}`
                      : '—'}
                  </span>
                  {stock.priceChangePercent !== null && (
                    <span
                      className={cn(
                        'peer-card-price-change',
                        stock.priceChangePercent >= 0 ? 'positive' : 'negative'
                      )}
                    >
                      {stock.priceChangePercent >= 0 ? '+' : ''}
                      {formatNumber(stock.priceChangePercent, 2)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="peer-card-metrics">
                {cardMetrics.map((metric) => {
                  const metricIdx = METRICS.findIndex(
                    (m) => m.key === metric.key
                  );
                  const rank = rankings[metricIdx]?.get(stock.ticker);
                  const value = stock[metric.key];
                  return (
                    <div
                      key={metric.key}
                      className={cn(
                        'peer-card-metric',
                        rank === 'best' && 'best',
                        rank === 'worst' && 'worst'
                      )}
                    >
                      <span className="peer-card-metric-label">
                        {metric.label}
                      </span>
                      <span className="peer-card-metric-value">
                        {metric.format(value)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="peer-card-footer">
                <span className="peer-card-rec-label">Recommendation</span>
                <span
                  className={cn(
                    'recommendation-badge',
                    stock.consensusScore !== null &&
                      (stock.consensusScore > 0.5
                        ? 'positive'
                        : stock.consensusScore < -0.5
                        ? 'negative'
                        : 'neutral')
                  )}
                >
                  {stock.recommendationKey?.toUpperCase().replace('_', ' ') ??
                    '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="peers-legend">
        <span className="legend-item best">Best</span>
        <span className="legend-item worst">Worst</span>
        <span className="legend-item current">Your Stock</span>
      </div>
    </div>
  );
}
