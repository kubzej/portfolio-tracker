import type { FundamentalMetrics, EarningsData } from '@/services/api/analysis';
import { InfoTooltip, MetricCard } from '@/components/shared';
import { CardTitle, Muted } from '@/components/shared/Typography';
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
        <div className="no-data">
          <Muted>No fundamental data available</Muted>
        </div>
      </div>
    );
  }

  return (
    <div className="research-fundamentals">
      {/* Profitability */}
      <section className="fundamentals-section">
        <CardTitle>Profitability</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="ROE"
            value={f.roe !== null ? formatPercent(f.roe, 1) : null}
            tooltip={
              <InfoTooltip text="Rentabilita vlastního kapitálu. Kolik zisku firma vydělá na každou korunu vloženého kapitálu akcionářů. Nad 15 % je výborné." />
            }
            sentiment={getROESentiment(f.roe)}
          />
          <MetricCard
            label="ROA"
            value={f.roa !== null ? formatPercent(f.roa, 1) : null}
            tooltip={
              <InfoTooltip text="Rentabilita aktiv. Jak efektivně firma využívá svá aktiva k tvorbě zisku. Nad 10 % je velmi dobré." />
            }
            sentiment={getROASentiment(f.roa)}
          />
          <MetricCard
            label="Gross Margin"
            value={
              f.grossMargin !== null ? formatPercent(f.grossMargin, 1) : null
            }
            tooltip={
              <InfoTooltip text="Hrubá marže. Podíl zisku po odečtení přímých nákladů na výrobu. Vyšší = lepší cenová síla." />
            }
            sentiment={getMarginSentiment(f.grossMargin, 40)}
          />
          <MetricCard
            label="Operating Margin"
            value={
              f.operatingMargin !== null
                ? formatPercent(f.operatingMargin, 1)
                : null
            }
            tooltip={
              <InfoTooltip text="Provozní marže. Zisk z běžné činnosti jako % tržeb. Ukazuje efektivitu provozu. Nad 15 % je dobré." />
            }
            sentiment={getMarginSentiment(f.operatingMargin, 15)}
          />
          <MetricCard
            label="Net Margin"
            value={f.netMargin !== null ? formatPercent(f.netMargin, 1) : null}
            tooltip={
              <InfoTooltip text="Čistá marže. Kolik z každé koruny tržeb zůstane jako čistý zisk. Nad 10 % je zdravé." />
            }
            sentiment={getMarginSentiment(f.netMargin, 10)}
          />
        </div>
      </section>

      {/* Growth */}
      <section className="fundamentals-section">
        <CardTitle>Growth</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="Revenue Growth"
            value={
              f.revenueGrowth !== null
                ? formatPercent(f.revenueGrowth, 1)
                : null
            }
            tooltip={
              <InfoTooltip text="Meziroční růst tržeb. Ukazuje, jak rychle firma roste. Kladné hodnoty = firma expanduje." />
            }
            sentiment={getGrowthSentiment(f.revenueGrowth)}
          />
          <MetricCard
            label="Revenue 5Y CAGR"
            value={
              f.revenueGrowth5Y !== null
                ? formatPercent(f.revenueGrowth5Y, 1)
                : null
            }
            tooltip={
              <InfoTooltip text="Průměrný roční růst tržeb za 5 let (CAGR). Lépe ukazuje dlouhodobý trend než jednorázový skok." />
            }
            sentiment={getGrowthSentiment(f.revenueGrowth5Y)}
          />
          <MetricCard
            label="EPS Growth"
            value={f.epsGrowth !== null ? formatPercent(f.epsGrowth, 1) : null}
            tooltip={
              <InfoTooltip text="Meziroční růst zisku na akcii. Klíčový ukazatel pro akcionáře - roste-li zisk, měla by růst i cena." />
            }
            sentiment={getGrowthSentiment(f.epsGrowth)}
          />
          <MetricCard
            label="EPS 5Y CAGR"
            value={
              f.epsGrowth5Y !== null ? formatPercent(f.epsGrowth5Y, 1) : null
            }
            tooltip={
              <InfoTooltip text="Průměrný roční růst zisku na akcii za 5 let. Stabilní růst nad 10 % ročně je skvělý." />
            }
            sentiment={getGrowthSentiment(f.epsGrowth5Y)}
          />
        </div>
      </section>

      {/* Financial Health */}
      <section className="fundamentals-section">
        <CardTitle>Financial Health</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="Debt/Equity"
            value={f.debtToEquity?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="Poměr dluhu k vlastnímu kapitálu. Pod 0,5 = konzervativní, nad 2 = vyšší riziko. Záleží na odvětví." />
            }
            sentiment={getDebtSentiment(f.debtToEquity)}
          />
          <MetricCard
            label="Current Ratio"
            value={f.currentRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="Běžná likvidita. Schopnost splatit krátkodobé závazky. Nad 1,5 je zdravé, pod 1 může signalizovat problémy." />
            }
            sentiment={getCurrentRatioSentiment(f.currentRatio)}
          />
          <MetricCard
            label="Quick Ratio"
            value={f.quickRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="Pohotová likvidita. Jako Current Ratio, ale bez zásob. Přísnější test platební schopnosti." />
            }
            sentiment={getCurrentRatioSentiment(f.quickRatio)}
          />
          <MetricCard
            label="Beta"
            value={f.beta?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="Volatilita vůči trhu. 1 = jako trh, >1 = volatilnější, <1 = stabilnější. Pod 0,5 = defenzivní akcie." />
            }
          />
        </div>
      </section>

      {/* Dividends (if applicable) */}
      {(f.dividendYield !== null || f.payoutRatio !== null) && (
        <section className="fundamentals-section">
          <CardTitle>Dividends</CardTitle>
          <div className="metrics-grid">
            <MetricCard
              label="Dividend Yield"
              value={
                f.dividendYield !== null
                  ? formatPercent(f.dividendYield, 2)
                  : null
              }
              tooltip={
                <InfoTooltip text="Dividendový výnos. Roční dividenda / cena akcie. Nad 3 % je atraktivní pro příjmové investory." />
              }
              sentiment={
                f.dividendYield !== null
                  ? f.dividendYield > 3
                    ? 'positive'
                    : 'neutral'
                  : undefined
              }
            />
            <MetricCard
              label="Payout Ratio"
              value={
                f.payoutRatio !== null ? formatPercent(f.payoutRatio, 1) : null
              }
              tooltip={
                <InfoTooltip text="Výplatní poměr. Kolik % zisku jde na dividendy. Pod 60 % je udržitelné, nad 80 % může být rizikové." />
              }
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
          <CardTitle>Recent Earnings</CardTitle>
          <div className="earnings-grid">
            {earnings.slice(0, 4).map((e, i) => (
              <div key={i} className="earnings-card">
                <div className="earnings-card-header">
                  <span className="earnings-quarter">
                    {formatQuarter(e.period)}
                  </span>
                  <span
                    className={cn(
                      'earnings-surprise',
                      getSurpriseClass(e.surprisePercent)
                    )}
                  >
                    {e.surprisePercent !== null
                      ? `${
                          e.surprisePercent > 0 ? '+' : ''
                        }${e.surprisePercent.toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="earnings-card-body">
                  <div className="earnings-stat">
                    <span className="earnings-label">Actual</span>
                    <span className="earnings-value">
                      ${e.actual?.toFixed(2) ?? '—'}
                    </span>
                  </div>
                  <div className="earnings-stat">
                    <span className="earnings-label">Est.</span>
                    <span className="earnings-value">
                      ${e.estimate?.toFixed(2) ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
