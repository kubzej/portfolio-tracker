import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchPeersData,
  type PeerData,
  type PeersResult,
} from '@/services/api/peers';
import { formatNumber, formatPercent, formatLargeNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { LoadingSpinner, ErrorState, InfoTooltip } from '@/components/shared';
import { useSortable } from '@/hooks';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from 'recharts';
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
  | 'marketCap'
  | 'return1M'
  | 'return3M'
  | 'return6M'
  | 'return1Y';

type PerformanceSortField =
  | 'ticker'
  | 'return1M'
  | 'return3M'
  | 'return6M'
  | 'return1Y';

interface MetricConfig {
  key: MetricKey;
  label: string;
  shortLabel?: string;
  tooltip: string;
  format: (value: number | null) => string;
  higherIsBetter: boolean;
  lowerIsBetterIfPositive?: boolean;
  category: 'valuation' | 'profitability' | 'growth' | 'performance' | 'size';
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
    category: 'valuation',
  },
  {
    key: 'evEbitda',
    label: 'EV/EBITDA',
    tooltip: 'Enterprise Value to EBITDA. Nižší = levnější valuace.',
    format: (v) => (v !== null ? formatNumber(v, 1) : '—'),
    higherIsBetter: false,
    lowerIsBetterIfPositive: true,
    category: 'valuation',
  },
  {
    key: 'roe',
    label: 'ROE',
    tooltip:
      'Return on Equity - rentabilita vlastního kapitálu. Vyšší = lepší.',
    format: (v) => (v !== null ? formatPercent(v) : '—'),
    higherIsBetter: true,
    category: 'profitability',
  },
  {
    key: 'netMargin',
    label: 'Margin',
    tooltip: 'Čistá zisková marže. Vyšší = vyšší profitabilita.',
    format: (v) => (v !== null ? formatPercent(v) : '—'),
    higherIsBetter: true,
    category: 'profitability',
  },
  {
    key: 'revenueGrowth',
    label: 'Rev Growth',
    shortLabel: 'Growth',
    tooltip: 'Meziroční růst tržeb. Vyšší = rychlejší růst.',
    format: (v) => (v !== null ? formatPercent(v) : '—'),
    higherIsBetter: true,
    category: 'growth',
  },
  {
    key: 'targetUpside',
    label: 'Upside',
    tooltip: 'Potenciální růst k cílovému kurzu analytiků.',
    format: (v) =>
      v !== null ? `${v > 0 ? '+' : ''}${formatNumber(v, 1)}%` : '—',
    higherIsBetter: true,
    category: 'valuation',
  },
  {
    key: 'return1M',
    label: '1M Return',
    shortLabel: '1M',
    tooltip: 'Výnos za poslední měsíc.',
    format: (v) =>
      v !== null ? `${v > 0 ? '+' : ''}${formatNumber(v, 1)}%` : '—',
    higherIsBetter: true,
    category: 'performance',
  },
  {
    key: 'return3M',
    label: '3M Return',
    shortLabel: '3M',
    tooltip: 'Výnos za poslední 3 měsíce.',
    format: (v) =>
      v !== null ? `${v > 0 ? '+' : ''}${formatNumber(v, 1)}%` : '—',
    higherIsBetter: true,
    category: 'performance',
  },
  {
    key: 'return6M',
    label: '6M Return',
    shortLabel: '6M',
    tooltip: 'Výnos za posledních 6 měsíců.',
    format: (v) =>
      v !== null ? `${v > 0 ? '+' : ''}${formatNumber(v, 1)}%` : '—',
    higherIsBetter: true,
    category: 'performance',
  },
  {
    key: 'return1Y',
    label: '1Y Return',
    shortLabel: '1Y',
    tooltip: 'Výnos za poslední rok.',
    format: (v) =>
      v !== null ? `${v > 0 ? '+' : ''}${formatNumber(v, 1)}%` : '—',
    higherIsBetter: true,
    category: 'performance',
  },
  {
    key: 'marketCap',
    label: 'Market Cap',
    tooltip: 'Tržní kapitalizace společnosti.',
    format: (v) => (v !== null ? formatLargeNumber(v) : '—'),
    higherIsBetter: false,
    category: 'size',
  },
];

// Get table metrics (exclude performance, they have separate section)
const TABLE_METRICS = METRICS.filter(
  (m) => m.category !== 'performance' && m.key !== 'marketCap'
);
const PERFORMANCE_METRICS = METRICS.filter((m) => m.category === 'performance');
const RADAR_METRICS = METRICS.filter((m) =>
  ['peRatio', 'roe', 'netMargin', 'revenueGrowth', 'targetUpside'].includes(
    m.key
  )
);

// Helper: Get size category
function getSizeCategory(marketCap: number | null): {
  label: string;
  class: string;
} {
  if (marketCap === null) return { label: '—', class: '' };
  if (marketCap >= 200000) return { label: 'Mega Cap', class: 'mega' };
  if (marketCap >= 10000) return { label: 'Large Cap', class: 'large' };
  if (marketCap >= 2000) return { label: 'Mid Cap', class: 'mid' };
  if (marketCap >= 300) return { label: 'Small Cap', class: 'small' };
  return { label: 'Micro Cap', class: 'micro' };
}

// Helper: Calculate valuation score (0-100, lower P/E and EV/EBITDA = higher score)
function calculateValuationScore(stock: PeerData): number | null {
  const pe = stock.peRatio;
  const evEbitda = stock.evEbitda;

  if (pe === null && evEbitda === null) return null;

  let score = 50;

  // P/E scoring (0-50 points)
  if (pe !== null && pe > 0) {
    if (pe < 10) score += 25;
    else if (pe < 15) score += 20;
    else if (pe < 20) score += 15;
    else if (pe < 30) score += 10;
    else if (pe < 50) score += 5;
    else score -= 10;
  }

  // EV/EBITDA scoring (0-50 points)
  if (evEbitda !== null && evEbitda > 0) {
    if (evEbitda < 8) score += 25;
    else if (evEbitda < 12) score += 20;
    else if (evEbitda < 16) score += 15;
    else if (evEbitda < 25) score += 10;
    else if (evEbitda < 40) score += 5;
    else score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

// Helper: Get rankings with position numbers
function getFullRankings(
  allStocks: PeerData[],
  metricKey: MetricKey,
  higherIsBetter: boolean,
  lowerIsBetterIfPositive?: boolean
): Map<
  string,
  { rank: number; total: number; position: 'best' | 'worst' | null }
> {
  const rankings = new Map<
    string,
    { rank: number; total: number; position: 'best' | 'worst' | null }
  >();

  const validStocks = allStocks.filter((s) => {
    const val = s[metricKey];
    return val !== null && val !== undefined && !isNaN(val as number);
  });

  if (validStocks.length < 2) {
    allStocks.forEach((s) =>
      rankings.set(s.ticker, { rank: 0, total: 0, position: null })
    );
    return rankings;
  }

  const values = validStocks.map((s) => ({
    ticker: s.ticker,
    value: s[metricKey] as number,
  }));

  values.sort((a, b) => {
    if (lowerIsBetterIfPositive) {
      const aPositive = a.value > 0;
      const bPositive = b.value > 0;
      if (aPositive && !bPositive) return -1;
      if (!aPositive && bPositive) return 1;
      if (aPositive && bPositive) return a.value - b.value;
      return b.value - a.value;
    }
    return higherIsBetter ? b.value - a.value : a.value - b.value;
  });

  allStocks.forEach((s) =>
    rankings.set(s.ticker, {
      rank: 0,
      total: validStocks.length,
      position: null,
    })
  );

  values.forEach((v, idx) => {
    const existing = rankings.get(v.ticker)!;
    existing.rank = idx + 1;
    if (idx === 0) existing.position = 'best';
    if (idx === values.length - 1) existing.position = 'worst';
  });

  return rankings;
}

// Helper: Calculate average for industry comparison
function calculateAverage(stocks: PeerData[], key: MetricKey): number | null {
  const values = stocks
    .map((s) => s[key])
    .filter((v): v is number => v !== null && !isNaN(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Helper: Generate insights
function generateInsights(
  mainStock: PeerData,
  peers: PeerData[],
  rankings: Map<
    MetricKey,
    Map<
      string,
      { rank: number; total: number; position: 'best' | 'worst' | null }
    >
  >
): string[] {
  const insights: string[] = [];
  const ticker = mainStock.ticker;
  const total = peers.length + 1;

  // Growth insight
  const growthRank = rankings.get('revenueGrowth')?.get(ticker);
  if (growthRank && mainStock.revenueGrowth !== null) {
    if (growthRank.position === 'best') {
      insights.push(
        `${ticker} leads in revenue growth at ${formatPercent(
          mainStock.revenueGrowth
        )}.`
      );
    } else if (growthRank.rank <= 2 && mainStock.revenueGrowth > 20) {
      insights.push(
        `${ticker} shows strong growth (${formatPercent(
          mainStock.revenueGrowth
        )}), ranking #${growthRank.rank} of ${total}.`
      );
    }
  }

  // Valuation insight
  const peRank = rankings.get('peRatio')?.get(ticker);
  if (peRank && mainStock.peRatio !== null && mainStock.peRatio > 0) {
    if (peRank.position === 'best') {
      insights.push(
        `${ticker} offers best value with lowest P/E (${formatNumber(
          mainStock.peRatio,
          1
        )}).`
      );
    } else if (peRank.position === 'worst' && mainStock.peRatio > 40) {
      insights.push(
        `${ticker} trades at premium valuation (P/E ${formatNumber(
          mainStock.peRatio,
          1
        )}).`
      );
    }
  }

  // Profitability insight
  const roeRank = rankings.get('roe')?.get(ticker);
  if (roeRank && mainStock.roe !== null) {
    if (roeRank.position === 'best' && mainStock.roe > 15) {
      insights.push(
        `${ticker} has strongest profitability with ROE of ${formatPercent(
          mainStock.roe
        )}.`
      );
    } else if (roeRank.rank <= 2) {
      insights.push(
        `${ticker} ranks #${roeRank.rank} in profitability (ROE ${formatPercent(
          mainStock.roe
        )}).`
      );
    }
  }

  // Upside insight
  const upsideRank = rankings.get('targetUpside')?.get(ticker);
  if (upsideRank && mainStock.targetUpside !== null) {
    if (upsideRank.position === 'best' && mainStock.targetUpside > 15) {
      insights.push(
        `Analysts see highest upside potential for ${ticker} (+${formatNumber(
          mainStock.targetUpside,
          1
        )}%).`
      );
    }
  }

  // Performance insight
  const return1YRank = rankings.get('return1Y')?.get(ticker);
  if (return1YRank && mainStock.return1Y !== null) {
    if (return1YRank.position === 'best') {
      insights.push(
        `${ticker} outperformed peers over the past year (+${formatNumber(
          mainStock.return1Y,
          1
        )}%).`
      );
    } else if (return1YRank.position === 'worst' && mainStock.return1Y < 0) {
      insights.push(
        `${ticker} underperformed peers over the past year (${formatNumber(
          mainStock.return1Y,
          1
        )}%).`
      );
    }
  }

  // Overall ranking summary
  const overallRanks = Array.from(rankings.values())
    .map((r) => r.get(ticker)?.rank)
    .filter((r): r is number => r !== undefined && r > 0);
  if (overallRanks.length > 3) {
    const avgRank =
      overallRanks.reduce((a, b) => a + b, 0) / overallRanks.length;
    if (avgRank <= 2) {
      insights.push(
        `Overall, ${ticker} ranks among the top performers across key metrics.`
      );
    } else if (avgRank >= total - 1) {
      insights.push(`${ticker} lags behind peers in most key metrics.`);
    }
  }

  return insights.slice(0, 3); // Max 3 insights
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

  // Calculate all rankings
  const { rankings, allStocks, radarData, industryAvg, insights } =
    useMemo(() => {
      if (!data)
        return {
          rankings: new Map(),
          allStocks: [],
          radarData: [],
          industryAvg: null,
          insights: [],
        };

      const allStocks = [data.mainStock, ...data.peers];

      const rankings = new Map<
        MetricKey,
        Map<
          string,
          { rank: number; total: number; position: 'best' | 'worst' | null }
        >
      >();
      METRICS.forEach((metric) => {
        rankings.set(
          metric.key,
          getFullRankings(
            allStocks,
            metric.key,
            metric.higherIsBetter,
            metric.lowerIsBetterIfPositive
          )
        );
      });

      // Industry average
      const industryAvg: Partial<Record<MetricKey, number | null>> = {};
      METRICS.forEach((m) => {
        industryAvg[m.key] = calculateAverage(data.peers, m.key);
      });

      // Radar chart data
      const radarData = RADAR_METRICS.map((metric) => {
        const mainValue = data.mainStock[metric.key];
        const avgValue = industryAvg[metric.key];

        // Normalize values to 0-100 scale
        const normalize = (val: number | null): number => {
          if (val === null) return 0;
          if (metric.key === 'peRatio' || metric.key === 'evEbitda') {
            // Lower is better, invert scale
            if (val <= 0) return 0;
            if (val < 10) return 100;
            if (val < 20) return 80;
            if (val < 30) return 60;
            if (val < 50) return 40;
            return 20;
          }
          // Higher is better
          if (metric.key === 'roe' || metric.key === 'netMargin') {
            if (val < 0) return 10;
            if (val > 50) return 100;
            return Math.min(100, val * 2);
          }
          if (metric.key === 'revenueGrowth') {
            if (val < -20) return 10;
            if (val > 50) return 100;
            return Math.min(100, 50 + val);
          }
          if (metric.key === 'targetUpside') {
            if (val < -20) return 10;
            if (val > 50) return 100;
            return Math.min(100, 50 + val);
          }
          return 50;
        };

        return {
          metric: metric.shortLabel || metric.label,
          [ticker]: normalize(mainValue),
          'Peer Avg': normalize(avgValue ?? null),
        };
      });

      // Generate insights
      const insights = generateInsights(data.mainStock, data.peers, rankings);

      return { rankings, allStocks, radarData, industryAvg, insights };
    }, [data, ticker]);

  // Value extractor for sorting
  const perfValueExtractor = useCallback(
    (stock: PeerData, field: PerformanceSortField) => {
      switch (field) {
        case 'ticker':
          return stock.ticker;
        case 'return1M':
          return stock.return1M;
        case 'return3M':
          return stock.return3M;
        case 'return6M':
          return stock.return6M;
        case 'return1Y':
          return stock.return1Y;
        default:
          return null;
      }
    },
    []
  );

  // Sorting for performance table
  const {
    sortedData: sortedPerformanceStocks,
    handleSort: handlePerfSort,
    getSortIndicator: getPerfSortIndicator,
    isSorted: isPerfSorted,
  } = useSortable<PeerData, PerformanceSortField>(
    allStocks,
    perfValueExtractor,
    {
      defaultField: 'return1Y',
      defaultDirection: 'desc',
      ascendingFields: ['ticker'],
    }
  );

  if (loading) {
    return <LoadingSpinner text="Loading peers data..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Failed to load data'} />;
  }

  if (data.peers.length === 0) {
    return (
      <div className="peers-empty">
        <p>No peer data available for this ticker.</p>
      </div>
    );
  }

  // Overall ranking for main stock
  const overallRanks = Array.from(rankings.values())
    .map((r) => r.get(ticker)?.rank)
    .filter((r): r is number => r !== undefined && r > 0);
  const avgRank =
    overallRanks.length > 0
      ? Math.round(
          (overallRanks.reduce((a, b) => a + b, 0) / overallRanks.length) * 10
        ) / 10
      : null;

  return (
    <div className="research-peers">
      {/* Header with Overall Ranking */}
      <div className="peers-header">
        <div className="peers-header-main">
          <h3>Peer Comparison</h3>
          <p className="peers-subtitle">
            Comparing with {data.peers.length} competitors
          </p>
        </div>
        {avgRank !== null && (
          <div className="overall-rank">
            <span className="overall-rank-label">Overall Rank</span>
            <span className="overall-rank-value">
              #{Math.round(avgRank)}{' '}
              <span className="overall-rank-total">of {allStocks.length}</span>
            </span>
          </div>
        )}
      </div>

      {/* Quick Insights */}
      {insights.length > 0 && (
        <div className="peers-insights">
          <h4>
            Key Insights
            <InfoTooltip text="Automaticky generované postřehy na základě porovnání s konkurencí." />
          </h4>
          <ul>
            {insights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Radar Chart */}
      <div className="peers-radar">
        <h4>
          Performance Profile
          <InfoTooltip text="Vizuální porovnání klíčových metrik s průměrem konkurence. Vyšší = lepší." />
        </h4>
        <div className="radar-chart-container">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart
              data={radarData}
              margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
            >
              <PolarGrid stroke="var(--border-light)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              />
              <Radar
                name={ticker}
                dataKey={ticker}
                stroke="var(--accent-primary)"
                fill="var(--accent-primary)"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Radar
                name="Peer Avg"
                dataKey="Peer Avg"
                stroke="var(--text-muted)"
                fill="var(--text-muted)"
                fillOpacity={0.1}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="radar-legend-custom">
          <div className="radar-legend-item main">
            <span className="radar-legend-dot"></span>
            <span>{ticker}</span>
          </div>
          <div className="radar-legend-item peer">
            <span className="radar-legend-line"></span>
            <span>Peer Avg</span>
          </div>
        </div>
      </div>

      {/* Historical Performance */}
      <div className="peers-performance">
        <h4>
          Historical Returns
          <InfoTooltip text="Výkonnost akcií za různá období. Klikni na záhlaví pro řazení." />
        </h4>
        <div className="performance-table-wrapper">
          <table className="performance-table">
            <thead>
              <tr>
                <th
                  className={cn('sortable', isPerfSorted('ticker') && 'sorted')}
                  onClick={() => handlePerfSort('ticker')}
                >
                  Stock {getPerfSortIndicator('ticker')}
                </th>
                {PERFORMANCE_METRICS.map((m) => (
                  <th
                    key={m.key}
                    className={cn(
                      'sortable',
                      isPerfSorted(m.key as PerformanceSortField) && 'sorted'
                    )}
                    onClick={() =>
                      handlePerfSort(m.key as PerformanceSortField)
                    }
                  >
                    {m.shortLabel}{' '}
                    {getPerfSortIndicator(m.key as PerformanceSortField)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPerformanceStocks.map((stock) => {
                const isCurrent = stock.ticker === ticker;
                return (
                  <tr key={stock.ticker} className={cn(isCurrent && 'current')}>
                    <td className="stock-cell">
                      <span className="perf-ticker">{stock.ticker}</span>
                      <span
                        className={cn(
                          'size-badge',
                          getSizeCategory(stock.marketCap).class
                        )}
                      >
                        {getSizeCategory(stock.marketCap).label}
                      </span>
                    </td>
                    {PERFORMANCE_METRICS.map((metric) => {
                      const value = stock[metric.key];
                      const ranking = rankings
                        .get(metric.key)
                        ?.get(stock.ticker);
                      return (
                        <td
                          key={metric.key}
                          className={cn(
                            ranking?.position === 'best' && 'best',
                            ranking?.position === 'worst' && 'worst'
                          )}
                        >
                          <span
                            className={cn(
                              'perf-value',
                              value !== null && value > 0 && 'positive',
                              value !== null && value < 0 && 'negative'
                            )}
                          >
                            {metric.format(value)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Valuation Score */}
      <div className="peers-valuation-scores">
        <h4>
          Valuation Score
          <InfoTooltip text="Kombinované hodnocení valuace na základě P/E a EV/EBITDA. Vyšší = levnější." />
        </h4>
        <div className="valuation-bars">
          {allStocks
            .map((stock) => ({
              stock,
              score: calculateValuationScore(stock),
            }))
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map(({ stock, score }, idx) => {
              const isCurrent = stock.ticker === ticker;
              return (
                <div
                  key={stock.ticker}
                  className={cn('valuation-bar-item', isCurrent && 'current')}
                >
                  <div className="valuation-bar-header">
                    <span className="valuation-rank">#{idx + 1}</span>
                    <span className="valuation-ticker">{stock.ticker}</span>
                    <span className="valuation-score">{score ?? '—'}</span>
                  </div>
                  <div className="valuation-bar-track">
                    <div
                      className="valuation-bar-fill"
                      style={{ width: `${score ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Main Comparison Table */}
      <div className="peers-table-section">
        <h4>
          Detailed Comparison
          <InfoTooltip text="Podrobné porovnání všech klíčových metrik." />
        </h4>
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
                <th className="avg-col">
                  <span className="stock-ticker">Avg</span>
                  <span className="stock-name">Industry</span>
                </th>
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
                <td className="avg-col">—</td>
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
                      {stock.recommendationKey
                        ?.toUpperCase()
                        .replace('_', ' ') ?? '—'}
                    </span>
                  </td>
                ))}
                <td className="avg-col">—</td>
              </tr>

              {/* Metric rows */}
              {TABLE_METRICS.map((metric) => {
                const metricRankings = rankings.get(metric.key);
                const avg = industryAvg?.[metric.key];
                return (
                  <tr key={metric.key}>
                    <td className="metric-col">
                      <span className="metric-label">
                        {metric.label}
                        <InfoTooltip text={metric.tooltip} />
                      </span>
                    </td>
                    {allStocks.map((stock) => {
                      const value = stock[metric.key];
                      const ranking = metricRankings?.get(stock.ticker);
                      return (
                        <td
                          key={stock.ticker}
                          className={cn(
                            'stock-col',
                            stock.ticker === ticker && 'current',
                            ranking?.position === 'best' && 'best',
                            ranking?.position === 'worst' && 'worst'
                          )}
                        >
                          <div className="metric-cell">
                            <span className="metric-value">
                              {metric.format(value)}
                            </span>
                            {ranking && ranking.rank > 0 && (
                              <span className="metric-rank">
                                #{ranking.rank}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="avg-col">
                      <span className="avg-value">
                        {metric.format(avg ?? null)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="peers-cards">
        {allStocks.map((stock) => {
          const isCurrent = stock.ticker === ticker;
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
          const sizeInfo = getSizeCategory(stock.marketCap);
          const valScore = calculateValuationScore(stock);

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
                  <span className={cn('size-badge', sizeInfo.class)}>
                    {sizeInfo.label}
                  </span>
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

              {/* Valuation Score Bar */}
              <div className="peer-card-valuation">
                <span className="valuation-label">Valuation Score</span>
                <div className="valuation-mini-bar">
                  <div
                    className="valuation-mini-fill"
                    style={{ width: `${valScore ?? 0}%` }}
                  />
                </div>
                <span className="valuation-mini-score">{valScore ?? '—'}</span>
              </div>

              <div className="peer-card-metrics">
                {cardMetrics.map((metric) => {
                  const ranking = rankings.get(metric.key)?.get(stock.ticker);
                  const value = stock[metric.key];
                  return (
                    <div
                      key={metric.key}
                      className={cn(
                        'peer-card-metric',
                        ranking?.position === 'best' && 'best',
                        ranking?.position === 'worst' && 'worst'
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

              {/* Performance Row */}
              <div className="peer-card-performance">
                {PERFORMANCE_METRICS.slice(0, 4).map((m) => {
                  const val = stock[m.key];
                  return (
                    <div key={m.key} className="perf-item">
                      <span className="perf-label">{m.shortLabel}</span>
                      <span
                        className={cn(
                          'perf-val',
                          val !== null && val > 0 && 'positive',
                          val !== null && val < 0 && 'negative'
                        )}
                      >
                        {m.format(val)}
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
        <span className="legend-item">
          <span className="legend-swatch best"></span>
          Best
        </span>
        <span className="legend-item">
          <span className="legend-swatch worst"></span>
          Worst
        </span>
        <span className="legend-item">
          <span className="legend-swatch current"></span>
          Your Stock
        </span>
      </div>
    </div>
  );
}
