import type { FundamentalMetrics, EarningsData } from '@/services/api/analysis';
import { InfoTooltip, MetricCard, IndicatorSignal } from '@/components/shared';
import type { SignalType } from '@/components/shared';
import {
  CardTitle,
  Muted,
  Text,
  MetricLabel,
  MetricValue,
} from '@/components/shared/Typography';
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
          <Muted>Nejsou dostupná fundamentální data</Muted>
        </div>
      </div>
    );
  }

  return (
    <div className="research-fundamentals">
      {/* Profitability */}
      <section className="fundamentals-section">
        <CardTitle>Ziskovost</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="ROE"
            value={f.roe !== null ? formatPercent(f.roe, 1) : null}
            tooltip={
              <InfoTooltip text="**ROE** | Návratnost vlastního kapitálu. | • Nad 15% = dobré | • Nad 20% = výborné | • Pod 10% = slabé" />
            }
            sentiment={getROESentiment(f.roe)}
          />
          <MetricCard
            label="ROA"
            value={f.roa !== null ? formatPercent(f.roa, 1) : null}
            tooltip={
              <InfoTooltip text="**ROA** | Návratnost aktiv. | • Nad 5% = dobré | • Nad 10% = výborné | Závisí na odvětví." />
            }
            sentiment={getROASentiment(f.roa)}
          />
          <MetricCard
            label="Gross Margin"
            value={
              f.grossMargin !== null ? formatPercent(f.grossMargin, 1) : null
            }
            tooltip={
              <InfoTooltip text="**Hrubá marže** | Tržby minus náklady na výrobu. | • Nad 40% = dobré | • Nad 60% = silné konkurenční výhody" />
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
              <InfoTooltip text="**Provozní marže** | Zisk z provozu jako procento tržeb. | • Nad 15% = dobré | • Nad 25% = výborné" />
            }
            sentiment={getMarginSentiment(f.operatingMargin, 15)}
          />
          <MetricCard
            label="Net Margin"
            value={f.netMargin !== null ? formatPercent(f.netMargin, 1) : null}
            tooltip={
              <InfoTooltip text="**Čistá marže** | Kolik procent z tržeb zůstane jako zisk. | • Nad 10% = dobré | • Nad 20% = výborné" />
            }
            sentiment={getMarginSentiment(f.netMargin, 10)}
          />
        </div>
      </section>

      {/* Growth */}
      <section className="fundamentals-section">
        <CardTitle>Růst</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="Revenue Growth"
            value={
              f.revenueGrowth !== null
                ? formatPercent(f.revenueGrowth, 1)
                : null
            }
            tooltip={
              <InfoTooltip text="**Růst tržeb** | Meziroční změna tržeb. | • Kladné = firma roste | • Záporné = tržby klesají | • Nad 10% = zdravý růst" />
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
              <InfoTooltip text="**5Y CAGR tržeb** | Průměrný roční růst tržeb za 5 let. | Lépe ukazuje dlouhodobý trend než jednorázový skok." />
            }
            sentiment={getGrowthSentiment(f.revenueGrowth5Y)}
          />
          <MetricCard
            label="EPS Growth"
            value={f.epsGrowth !== null ? formatPercent(f.epsGrowth, 1) : null}
            tooltip={
              <InfoTooltip text="**Růst zisku** | Meziroční změna zisku na akcii. | • Kladné = zisky rostou | • Záporné = zisky klesají" />
            }
            sentiment={getGrowthSentiment(f.epsGrowth)}
          />
          <MetricCard
            label="EPS 5Y CAGR"
            value={
              f.epsGrowth5Y !== null ? formatPercent(f.epsGrowth5Y, 1) : null
            }
            tooltip={
              <InfoTooltip text="**5Y CAGR zisku** | Průměrný roční růst zisku za 5 let. | Stabilní růst nad 10% ročně je skvělý." />
            }
            sentiment={getGrowthSentiment(f.epsGrowth5Y)}
          />
        </div>
      </section>

      {/* Financial Health */}
      <section className="fundamentals-section">
        <CardTitle>Finanční zdraví</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="Debt/Equity"
            value={f.debtToEquity?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Debt-to-Equity** | Poměr dluhu k vlastnímu kapitálu. | • Pod 0.5 = nízký dluh | • 0.5-2 = normální | • Nad 2 = vysoký dluh" />
            }
            sentiment={getDebtSentiment(f.debtToEquity)}
          />
          <MetricCard
            label="Current Ratio"
            value={f.currentRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Current Ratio** | Schopnost splácet krátkodobé dluhy. | • Nad 1 = může pokrýt závazky | • Nad 1.5 = zdravé | • Pod 1 = problémy" />
            }
            sentiment={getCurrentRatioSentiment(f.currentRatio)}
          />
          <MetricCard
            label="Quick Ratio"
            value={f.quickRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Quick Ratio** | Rychlá likvidita (bez zásob). | • Nad 1 = dobrá likvidita | • Pod 1 = možné problémy" />
            }
            sentiment={getCurrentRatioSentiment(f.quickRatio)}
          />
          <MetricCard
            label="Beta"
            value={f.beta?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Beta** | Volatilita ve srovnání s trhem. | • Beta = 1 = pohyb s trhem | • Beta > 1 = větší výkyvy | • Beta < 1 = stabilnější" />
            }
          />
        </div>
      </section>

      {/* Dividends (if applicable) */}
      {(f.dividendYield !== null || f.payoutRatio !== null) && (
        <section className="fundamentals-section">
          <CardTitle>Dividendy</CardTitle>
          <div className="metrics-grid">
            <MetricCard
              label="Dividend Yield"
              value={
                f.dividendYield !== null
                  ? formatPercent(f.dividendYield, 2)
                  : null
              }
              tooltip={
                <InfoTooltip text="**Dividendový výnos** | Roční dividenda jako procento ceny. | • 2-4% = normální | • Nad 5% = vysoký výnos | • 0% = nevyplácí dividendy" />
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
                <InfoTooltip text="**Payout Ratio** | Kolik procent zisku jde na dividendy. | • Pod 50% = udržitelné | • 50-75% = normální | • Nad 100% = neudržitelné" />
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
          <CardTitle>Poslední výsledky</CardTitle>
          <div className="earnings-grid">
            {earnings.slice(0, 4).map((e, i) => (
              <div key={i} className="earnings-card">
                <div className="earnings-card-header">
                  <Text weight="semibold" size="sm">
                    {formatQuarter(e.period)}
                  </Text>
                  <MetricValue
                    size="sm"
                    sentiment={
                      e.surprisePercent !== null
                        ? e.surprisePercent > 0
                          ? 'positive'
                          : e.surprisePercent < 0
                          ? 'negative'
                          : 'neutral'
                        : undefined
                    }
                  >
                    {e.surprisePercent !== null
                      ? `${
                          e.surprisePercent > 0 ? '+' : ''
                        }${e.surprisePercent.toFixed(1)}%`
                      : '—'}
                  </MetricValue>
                </div>
                <div className="earnings-card-body">
                  <div className="earnings-stat">
                    <MetricLabel>Actual</MetricLabel>
                    <Text weight="medium" size="sm">
                      ${e.actual?.toFixed(2) ?? '—'}
                    </Text>
                  </div>
                  <div className="earnings-stat">
                    <MetricLabel>Est.</MetricLabel>
                    <Text weight="medium" size="sm">
                      ${e.estimate?.toFixed(2) ?? '—'}
                    </Text>
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

  const signalType: SignalType =
    beats >= 3 ? 'bullish' : beats <= 1 ? 'bearish' : 'neutral';

  const message =
    beats === total
      ? 'Překonal očekávání ve všech čtvrtletích'
      : beats === 0
      ? 'Nesplnil očekávání v žádném čtvrtletí'
      : `Překonal očekávání ${beats}/${total} čtvrtletí`;

  return (
    <div className="earnings-summary-wrapper">
      <IndicatorSignal type={signalType}>{message}</IndicatorSignal>
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
