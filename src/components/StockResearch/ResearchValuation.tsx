import type { FundamentalMetrics } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { InfoTooltip, MetricCard } from '@/components/shared';
import {
  CardTitle,
  Muted,
  Text,
  Badge,
  Description,
} from '@/components/shared/Typography';
import './ResearchValuation.css';

interface ResearchValuationProps {
  fundamentals: FundamentalMetrics | null;
  recommendation: StockRecommendation | null;
}

export function ResearchValuation({
  fundamentals,
  recommendation,
}: ResearchValuationProps) {
  const f = fundamentals;

  if (!f) {
    return (
      <div className="research-valuation">
        <div className="no-data">
          <Muted>Nejsou dostupná data pro valuaci</Muted>
        </div>
      </div>
    );
  }

  // Calculate fair value estimates based on different methods
  const valuationMethods = calculateValuationMethods(f);

  return (
    <div className="research-valuation">
      {/* Valuation Multiples */}
      <section className="valuation-section">
        <CardTitle>Valuační násobky</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="P/E Ratio"
            value={f.peRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**P/E Ratio** | Poměr ceny k zisku na akcii. | • Pod 15 = levné | • 15-25 = normální | • Nad 25 = drahé nebo růstové" />
            }
            sentiment={getPESentiment(f.peRatio)}
          />
          <MetricCard
            label="Forward P/E"
            value={f.forwardPe?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Forward P/E** | P/E na základě očekávaných zisků. | • Fwd P/E < P/E = očekávaný růst zisků | • Fwd P/E > P/E = očekávaný pokles zisků" />
            }
            sentiment={getPESentiment(f.forwardPe)}
          />
          <MetricCard
            label="PEG Ratio"
            value={f.pegRatio?.toFixed(3) ?? null}
            tooltip={
              <InfoTooltip text="**PEG Ratio** | P/E dělené růstem zisku. | • Pod 1 = podhodnoceno vzhledem k růstu | • 1-1.5 = férová hodnota | • Nad 2 = drahé" />
            }
            sentiment={getPEGSentiment(f.pegRatio)}
          />
          <MetricCard
            label="P/B Ratio"
            value={f.pbRatio?.toFixed(3) ?? null}
            tooltip={
              <InfoTooltip text="**P/B Ratio** | Poměr ceny k účetní hodnotě. | • Pod 1 = potenciálně levná | • 1-3 = normální | • Nad 3 = drahá nebo silná značka" />
            }
            sentiment={getPBSentiment(f.pbRatio)}
          />
          <MetricCard
            label="P/S Ratio"
            value={f.psRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**P/S Ratio** | Poměr ceny k tržbám. | • Pod 2 = levné | • 2-5 = normální | • Nad 10 = drahé | Užitečné pro firmy bez zisku." />
            }
            sentiment={getPSSentiment(f.psRatio)}
          />
          <MetricCard
            label="EV/EBITDA"
            value={f.evEbitda?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**EV/EBITDA** | Hodnota firmy dělená provozním ziskem. | • Pod 10 = levné | • 10-15 = normální | • Nad 15 = drahé" />
            }
            sentiment={getEVEBITDASentiment(f.evEbitda)}
          />
        </div>
      </section>

      {/* Valuation Analysis */}
      {valuationMethods.length > 0 && (
        <section className="valuation-section">
          <CardTitle>Analýza valuace</CardTitle>
          <div className="valuation-analysis">
            {valuationMethods.map((method) => (
              <div key={method.name} className="valuation-method">
                <div className="method-header">
                  <Text weight="semibold">{method.name}</Text>
                  <Badge
                    variant={
                      method.sentiment === 'positive'
                        ? 'buy'
                        : method.sentiment === 'negative'
                        ? 'sell'
                        : 'hold'
                    }
                  >
                    {method.verdict}
                  </Badge>
                </div>
                <Description>{method.description}</Description>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Target Price Analysis */}
      {recommendation && recommendation.targetUpside !== null && (
        <section className="valuation-section">
          <CardTitle>Cíl analytiků</CardTitle>
          <div className="target-analysis">
            <MetricCard
              label="Cílová cena"
              value={
                recommendation.targetPrice
                  ? `$${recommendation.targetPrice.toFixed(2)}`
                  : null
              }
            />
            <MetricCard
              label="Potenciál"
              value={
                recommendation.targetUpside !== null
                  ? `${
                      recommendation.targetUpside > 0 ? '+' : ''
                    }${recommendation.targetUpside.toFixed(1)}%`
                  : null
              }
              sentiment={
                recommendation.targetUpside > 0 ? 'positive' : 'negative'
              }
            />
          </div>
        </section>
      )}

      {/* 52-Week Context */}
      <section className="valuation-section">
        <CardTitle>Cenový kontext</CardTitle>
        <div className="metrics-grid">
          {recommendation && (
            <>
              <MetricCard
                label="52T maximum"
                value={
                  recommendation.fiftyTwoWeekHigh
                    ? `$${recommendation.fiftyTwoWeekHigh.toFixed(2)}`
                    : null
                }
                tooltip={
                  <InfoTooltip text="**52T Maximum** | Nejvyšší cena za poslední rok." />
                }
              />
              <MetricCard
                label="52T minimum"
                value={
                  recommendation.fiftyTwoWeekLow
                    ? `$${recommendation.fiftyTwoWeekLow.toFixed(2)}`
                    : null
                }
                tooltip={
                  <InfoTooltip text="**52T Minimum** | Nejnižší cena za poslední rok." />
                }
              />
              <MetricCard
                label="Vzdálenost od 52T max"
                value={
                  recommendation.distanceFrom52wHigh !== null
                    ? `${recommendation.distanceFrom52wHigh.toFixed(1)}% pod`
                    : null
                }
                tooltip={
                  <InfoTooltip text="**Vzdálenost od maxima** | Jak daleko je cena od ročního maxima. | • Větší odstup může signalizovat příležitost | • Malý odstup = blízko maximům" />
                }
                sentiment={
                  recommendation.distanceFrom52wHigh !== null
                    ? recommendation.distanceFrom52wHigh > 20
                      ? 'positive'
                      : recommendation.distanceFrom52wHigh < 5
                      ? 'negative'
                      : 'neutral'
                    : undefined
                }
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// Valuation method analysis
interface ValuationMethod {
  name: string;
  verdict: string;
  description: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

function calculateValuationMethods(f: FundamentalMetrics): ValuationMethod[] {
  const methods: ValuationMethod[] = [];

  // P/E Analysis
  if (f.peRatio !== null && f.peRatio > 0) {
    let verdict: string;
    let sentiment: 'positive' | 'negative' | 'neutral';
    let description: string;

    if (f.peRatio < 12) {
      verdict = 'Podhodnoceno';
      sentiment = 'positive';
      description = `P/E ${f.peRatio.toFixed(
        1
      )} naznačuje potenciální podhodnocení. Porovnejte s průměrem sektoru.`;
    } else if (f.peRatio < 20) {
      verdict = 'Férová hodnota';
      sentiment = 'neutral';
      description = `P/E ${f.peRatio.toFixed(
        1
      )} je v typickém rozmezí pro zaváděné firmy.`;
    } else if (f.peRatio < 35) {
      verdict = 'Růstové prémium';
      sentiment = 'neutral';
      description = `P/E ${f.peRatio.toFixed(
        1
      )} odráží očekávaný růst. Ověřte s růstem zisků.`;
    } else {
      verdict = 'Drahé';
      sentiment = 'negative';
      description = `P/E ${f.peRatio.toFixed(
        1
      )} je vysoké. Vyžaduje silný růst pro ospravedlnění.`;
    }

    methods.push({ name: 'P/E analýza', verdict, description, sentiment });
  }

  // PEG Analysis
  if (f.pegRatio !== null && f.pegRatio > 0) {
    let verdict: string;
    let sentiment: 'positive' | 'negative' | 'neutral';
    let description: string;

    if (f.pegRatio < 1) {
      verdict = 'Podhodnoceno';
      sentiment = 'positive';
      description = `PEG ${f.pegRatio.toFixed(
        2
      )} pod 1 naznačuje, že cena plně neodráží růst.`;
    } else if (f.pegRatio < 1.5) {
      verdict = 'Férová hodnota';
      sentiment = 'neutral';
      description = `PEG ${f.pegRatio.toFixed(
        2
      )} indikuje vyvážnou valuaci vs růst.`;
    } else {
      verdict = 'Drahé';
      sentiment = 'negative';
      description = `PEG ${f.pegRatio.toFixed(
        2
      )} nad 1.5 naznačuje prémiovou cenu.`;
    }

    methods.push({ name: 'PEG analýza', verdict, description, sentiment });
  }

  // EV/EBITDA Analysis
  if (f.evEbitda !== null && f.evEbitda > 0) {
    let verdict: string;
    let sentiment: 'positive' | 'negative' | 'neutral';
    let description: string;

    if (f.evEbitda < 8) {
      verdict = 'Podhodnoceno';
      sentiment = 'positive';
      description = `EV/EBITDA ${f.evEbitda.toFixed(
        1
      )} je pod průměrem. Může signalizovat příležitost.`;
    } else if (f.evEbitda < 14) {
      verdict = 'Férová hodnota';
      sentiment = 'neutral';
      description = `EV/EBITDA ${f.evEbitda.toFixed(1)} je v typickém rozmezí.`;
    } else {
      verdict = 'Prémium';
      sentiment = 'negative';
      description = `EV/EBITDA ${f.evEbitda.toFixed(
        1
      )} je nad průměrem. Prémiová valuace.`;
    }

    methods.push({
      name: 'EV/EBITDA analýza',
      verdict,
      description,
      sentiment,
    });
  }

  return methods;
}

// Sentiment helpers
function getPESentiment(
  pe: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (pe === null) return undefined;
  if (pe < 0) return 'negative';
  if (pe < 15) return 'positive';
  if (pe > 35) return 'negative';
  return 'neutral';
}

function getPEGSentiment(
  peg: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (peg === null) return undefined;
  if (peg < 1) return 'positive';
  if (peg > 2) return 'negative';
  return 'neutral';
}

function getPBSentiment(
  pb: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (pb === null) return undefined;
  if (pb < 1) return 'positive';
  if (pb > 5) return 'negative';
  return 'neutral';
}

function getPSSentiment(
  ps: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (ps === null) return undefined;
  if (ps < 2) return 'positive';
  if (ps > 8) return 'negative';
  return 'neutral';
}

function getEVEBITDASentiment(
  evEbitda: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (evEbitda === null) return undefined;
  if (evEbitda < 8) return 'positive';
  if (evEbitda > 15) return 'negative';
  return 'neutral';
}
