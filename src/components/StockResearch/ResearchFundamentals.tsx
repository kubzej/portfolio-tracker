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
              <InfoTooltip text="**Return on Equity (ROE)** | Návratnost vlastního kapitálu. Ukazuje, kolik procent zisku firma vygeneruje z peněz akcionářů. | • Nad 15% = Firma efektivně zhodnocuje kapitál | • Nad 20% = Špičková efektivita (konkurenční výhoda) | • Pod 10% = Neefektivní využití kapitálu | Klíčový ukazatel kvality managementu." />
            }
            sentiment={getROESentiment(f.roe)}
          />
          <MetricCard
            label="ROA"
            value={f.roa !== null ? formatPercent(f.roa, 1) : null}
            tooltip={
              <InfoTooltip text="**Return on Assets (ROA)** | Návratnost aktiv. Ukazuje, jak efektivně firma využívá veškerý svůj majetek (stroje, budovy, hotovost) k tvorbě zisku. | • Nad 5% = Dobrá efektivita | • Nad 10% = Výborná efektivita | Důležité pro firmy s velkým majetkem (továrny, banky)." />
            }
            sentiment={getROASentiment(f.roa)}
          />
          <MetricCard
            label="Gross Margin"
            value={
              f.grossMargin !== null ? formatPercent(f.grossMargin, 1) : null
            }
            tooltip={
              <InfoTooltip text="**Hrubá marže** | Zisk pouze po odečtení přímých nákladů na výrobu. Ukazuje sílu značky a cenotvorbu. | • Nad 40% = Firma má silnou pozici na trhu | • Nad 60% = Obrovská konkurenční výhoda (moat) | Stabilní vysoká hrubá marže je znakem kvalitního byznysu." />
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
              <InfoTooltip text="**Provozní marže** | Zisk z hlavní činnosti firmy (před zdaněním a úroky) jako procento z tržeb. | • Nad 15% = Zdravý byznys model | • Nad 25% = Velmi ziskový byznys | Ukazuje, kolik firmě zůstane po zaplacení provozních nákladů (mzdy, nájem, marketing)." />
            }
            sentiment={getMarginSentiment(f.operatingMargin, 15)}
          />
          <MetricCard
            label="Net Margin"
            value={f.netMargin !== null ? formatPercent(f.netMargin, 1) : null}
            tooltip={
              <InfoTooltip text="**Čistá zisková marže** | Kolik procent z každého utrženého dolaru firmě zůstane jako čistý zisk po zaplacení všech nákladů a daní. | • Nad 10% = Zdravá ziskovost | • Nad 20% = Velmi vysoká ziskovost (často software/služby) | • Nízká marže (pod 5%) je riziková při poklesu tržeb." />
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
              <InfoTooltip text="**Růst tržeb** | O kolik procent vzrostly tržby firmy oproti minulému roku. | • Nad 15% = Rychle rostoucí firma (Growth) | • 0-5% = Pomalý, stabilní růst (Mature) | • Záporný růst = Firma se zmenšuje (varovný signál) | Růst tržeb je motor budoucích zisků." />
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
              <InfoTooltip text="**5Y CAGR tržeb** | Průměrný roční růst tržeb za posledních 5 let. | • Vyhlazuje jednorázové výkyvy | • Ukazuje dlouhodobou schopnost firmy růst | Stabilní růst nad 10% ročně je znakem kvalitní růstové firmy." />
            }
            sentiment={getGrowthSentiment(f.revenueGrowth5Y)}
          />
          <MetricCard
            label="EPS Growth"
            value={f.epsGrowth !== null ? formatPercent(f.epsGrowth, 1) : null}
            tooltip={
              <InfoTooltip text="**Růst zisku (EPS Growth)** | Meziroční změna zisku na jednu akcii. | • Růst EPS je hlavním motorem růstu ceny akcie | • Pokud tržby rostou, ale EPS klesá, firma má rostoucí náklady nebo ředí akcie." />
            }
            sentiment={getGrowthSentiment(f.epsGrowth)}
          />
          <MetricCard
            label="EPS 5Y CAGR"
            value={
              f.epsGrowth5Y !== null ? formatPercent(f.epsGrowth5Y, 1) : null
            }
            tooltip={
              <InfoTooltip text="**5Y CAGR zisku** | Průměrný roční růst zisku na akcii za posledních 5 let. | • Klíčový ukazatel pro dlouhodobé investory | • Stabilní růst nad 10% často vede k dlouhodobému růstu ceny akcie." />
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
              <InfoTooltip text="**Debt-to-Equity (D/E)** | Poměr dluhu k vlastnímu jmění. Ukazuje, jak moc je firma financovaná dluhem. | • Pod 0.5 = Velmi bezpečné, firma má málo dluhů | • Nad 2.0 = Rizikové, firma je silně zadlužená | V době vysokých úroků je vysoký dluh nebezpečný." />
            }
            sentiment={getDebtSentiment(f.debtToEquity)}
          />
          <MetricCard
            label="Current Ratio"
            value={f.currentRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Current Ratio** | Poměr oběžných aktiv (hotovost, zásoby) ke krátkodobým dluhům. Měří schopnost splácet závazky v příštím roce. | • Nad 1.5 = Bezpečné, firma má dostatek prostředků | • Pod 1.0 = Riziko, firma může mít problém splácet účty | Příliš vysoké číslo může znamenat neefektivní využití hotovosti." />
            }
            sentiment={getCurrentRatioSentiment(f.currentRatio)}
          />
          <MetricCard
            label="Quick Ratio"
            value={f.quickRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Quick Ratio** | Přísnější verze Current Ratio. Počítá jen s hotovostí a pohledávkami (bez zásob). | • Nad 1.0 = Firma dokáže okamžitě splatit krátkodobé dluhy | • Pod 1.0 = Firma spoléhá na prodej zásob, aby zaplatila dluhy | Důležité v krizích, kdy se zásoby špatně prodávají." />
            }
            sentiment={getCurrentRatioSentiment(f.quickRatio)}
          />
          <MetricCard
            label="Beta"
            value={f.beta?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Beta** | Měří, jak moc akcie 'skáče' oproti trhu (S&P 500). | • Beta 1.0 = Akcie se hýbe stejně jako trh | • Beta > 1.5 = Vysoká volatilita (agresivní růst nebo risk) | • Beta < 0.8 = Nízká volatilita (defenzivní akcie, např. Coca-Cola) | Vyšší Beta znamená vyšší riziko, ale i potenciál zisku." />
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
                <InfoTooltip text="**Dividendový výnos** | Kolik procent z ceny akcie vám firma ročně vyplatí na dividendách. | • 2-4% = Běžný, udržitelný výnos | • Nad 6% = Podezřele vysoký výnos (trh čeká pokles dividendy nebo ceny) | • 0% = Firma reinvestuje zisk (běžné u růstových firem)." />
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
