import type { FundamentalMetrics, EarningsData } from '@/services/api/analysis';
import { MetricRow } from '@/components/shared';
import { cn } from '@/utils/cn';
import { formatPercent } from '@/utils/format';
import './ResearchFundamentals.css';

interface ResearchFundamentalsProps {
  fundamentals: FundamentalMetrics | null;
  earnings: EarningsData[] | null;
}

export function ResearchFundamentals({
  fundamentals,
  earnings,
}: ResearchFundamentalsProps) {
  const f = fundamentals;

  if (!f) {
    return (
      <div className="research-fundamentals">
        <div className="no-data">No fundamental data available</div>
      </div>
    );
  }

  return (
    <div className="research-fundamentals">
      {/* Profitability */}
      <section className="fundamentals-section">
        <h3 className="section-title">Profitability</h3>
        <div className="metrics-grid">
          <MetricRow
            label="ROE"
            value={f.roe !== null ? formatPercent(f.roe, 1) : null}
            tooltip="Return on Equity. Above 15% is excellent."
            sentiment={getROESentiment(f.roe)}
          />
          <MetricRow
            label="ROA"
            value={f.roa !== null ? formatPercent(f.roa, 1) : null}
            tooltip="Return on Assets"
            sentiment={getROASentiment(f.roa)}
          />
          <MetricRow
            label="Gross Margin"
            value={
              f.grossMargin !== null ? formatPercent(f.grossMargin, 1) : null
            }
            tooltip="Gross profit as % of revenue"
            sentiment={getMarginSentiment(f.grossMargin, 40)}
          />
          <MetricRow
            label="Operating Margin"
            value={
              f.operatingMargin !== null
                ? formatPercent(f.operatingMargin, 1)
                : null
            }
            tooltip="Operating profit as % of revenue"
            sentiment={getMarginSentiment(f.operatingMargin, 15)}
          />
          <MetricRow
            label="Net Margin"
            value={f.netMargin !== null ? formatPercent(f.netMargin, 1) : null}
            tooltip="Net income as % of revenue"
            sentiment={getMarginSentiment(f.netMargin, 10)}
          />
        </div>
      </section>

      {/* Growth */}
      <section className="fundamentals-section">
        <h3 className="section-title">Growth</h3>
        <div className="metrics-grid">
          <MetricRow
            label="Revenue Growth"
            value={
              f.revenueGrowth !== null
                ? formatPercent(f.revenueGrowth, 1)
                : null
            }
            tooltip="Year-over-year revenue growth"
            sentiment={getGrowthSentiment(f.revenueGrowth)}
          />
          <MetricRow
            label="Revenue Growth 5Y CAGR"
            value={
              f.revenueGrowth5Y !== null
                ? formatPercent(f.revenueGrowth5Y, 1)
                : null
            }
            tooltip="5-year compound annual growth rate"
            sentiment={getGrowthSentiment(f.revenueGrowth5Y)}
          />
          <MetricRow
            label="EPS Growth"
            value={f.epsGrowth !== null ? formatPercent(f.epsGrowth, 1) : null}
            tooltip="Year-over-year EPS growth"
            sentiment={getGrowthSentiment(f.epsGrowth)}
          />
          <MetricRow
            label="EPS Growth 5Y"
            value={
              f.epsGrowth5Y !== null ? formatPercent(f.epsGrowth5Y, 1) : null
            }
            tooltip="5-year EPS compound annual growth rate"
            sentiment={getGrowthSentiment(f.epsGrowth5Y)}
          />
        </div>
      </section>

      {/* Financial Health */}
      <section className="fundamentals-section">
        <h3 className="section-title">Financial Health</h3>
        <div className="metrics-grid">
          <MetricRow
            label="Debt/Equity"
            value={f.debtToEquity?.toFixed(2) ?? null}
            tooltip="Total debt divided by shareholder equity. Lower is generally better."
            sentiment={getDebtSentiment(f.debtToEquity)}
          />
          <MetricRow
            label="Current Ratio"
            value={f.currentRatio?.toFixed(2) ?? null}
            tooltip="Current assets / current liabilities. Above 1.5 is healthy."
            sentiment={getCurrentRatioSentiment(f.currentRatio)}
          />
          <MetricRow
            label="Quick Ratio"
            value={f.quickRatio?.toFixed(2) ?? null}
            tooltip="Liquid assets / current liabilities"
            sentiment={getCurrentRatioSentiment(f.quickRatio)}
          />
          <MetricRow
            label="Beta"
            value={f.beta?.toFixed(2) ?? null}
            tooltip="Volatility relative to market. 1 = market average."
          />
        </div>
      </section>

      {/* Dividends (if applicable) */}
      {(f.dividendYield !== null || f.payoutRatio !== null) && (
        <section className="fundamentals-section">
          <h3 className="section-title">Dividends</h3>
          <div className="metrics-grid">
            <MetricRow
              label="Dividend Yield"
              value={
                f.dividendYield !== null
                  ? formatPercent(f.dividendYield, 2)
                  : null
              }
              sentiment={
                f.dividendYield !== null
                  ? f.dividendYield > 3
                    ? 'positive'
                    : 'neutral'
                  : undefined
              }
            />
            <MetricRow
              label="Payout Ratio"
              value={
                f.payoutRatio !== null ? formatPercent(f.payoutRatio, 1) : null
              }
              tooltip="% of earnings paid as dividends. Under 60% is sustainable."
              sentiment={
                f.payoutRatio !== null
                  ? f.payoutRatio < 60
                    ? 'positive'
                    : f.payoutRatio > 80
                    ? 'negative'
                    : 'neutral'
                  : undefined
              }
            />
          </div>
        </section>
      )}

      {/* Earnings History */}
      {earnings && earnings.length > 0 && (
        <section className="fundamentals-section">
          <h3 className="section-title">Recent Earnings</h3>
          <div className="earnings-table-wrapper">
            <table className="earnings-table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th className="right">Actual EPS</th>
                  <th className="right">Expected EPS</th>
                  <th className="right">Surprise</th>
                </tr>
              </thead>
              <tbody>
                {earnings.slice(0, 4).map((e, i) => (
                  <tr key={i}>
                    <td>{formatQuarter(e.period)}</td>
                    <td className="right">${e.actual?.toFixed(2) ?? '—'}</td>
                    <td className="right">${e.estimate?.toFixed(2) ?? '—'}</td>
                    <td
                      className={cn(
                        'right',
                        getSurpriseClass(e.surprisePercent)
                      )}
                    >
                      {e.surprisePercent !== null
                        ? `${
                            e.surprisePercent > 0 ? '+' : ''
                          }${e.surprisePercent.toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EarningsSummary earnings={earnings.slice(0, 4)} />
        </section>
      )}
    </div>
  );
}

// Earnings summary component
interface EarningsSummaryProps {
  earnings: EarningsData[];
}

function EarningsSummary({ earnings }: EarningsSummaryProps) {
  const beats = earnings.filter((e) => (e.surprisePercent ?? 0) > 0).length;
  const total = earnings.length;

  return (
    <div
      className={cn(
        'earnings-summary',
        beats >= 3 ? 'positive' : beats <= 1 ? 'negative' : 'neutral'
      )}
    >
      {beats === total && '✓ Beat expectations in all quarters'}
      {beats === 0 && '✗ Missed expectations in all quarters'}
      {beats > 0 &&
        beats < total &&
        `Beat expectations ${beats}/${total} quarters`}
    </div>
  );
}

// Helper functions
function formatQuarter(period: string | null): string {
  if (!period) return '—';
  // period is like "2024-03-31"
  const date = new Date(period);
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${quarter} ${year}`;
}

function getSurpriseClass(surprise: number | null): string {
  if (surprise === null) return '';
  if (surprise > 0) return 'positive';
  if (surprise < 0) return 'negative';
  return '';
}

function getROESentiment(
  roe: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (roe === null) return undefined;
  if (roe > 18) return 'positive';
  if (roe < 8) return 'negative';
  return 'neutral';
}

function getROASentiment(
  roa: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (roa === null) return undefined;
  if (roa > 10) return 'positive';
  if (roa < 3) return 'negative';
  return 'neutral';
}

function getMarginSentiment(
  margin: number | null,
  threshold: number
): 'positive' | 'negative' | 'neutral' | undefined {
  if (margin === null) return undefined;
  if (margin > threshold) return 'positive';
  if (margin < 0) return 'negative';
  return 'neutral';
}

function getGrowthSentiment(
  growth: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (growth === null) return undefined;
  if (growth > 15) return 'positive';
  if (growth < 0) return 'negative';
  return 'neutral';
}

function getDebtSentiment(
  debt: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (debt === null) return undefined;
  if (debt < 0.5) return 'positive';
  if (debt > 2) return 'negative';
  return 'neutral';
}

function getCurrentRatioSentiment(
  ratio: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (ratio === null) return undefined;
  if (ratio > 1.5) return 'positive';
  if (ratio < 1) return 'negative';
  return 'neutral';
}
