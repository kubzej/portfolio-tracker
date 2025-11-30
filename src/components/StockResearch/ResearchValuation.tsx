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
          <Muted>No valuation data available</Muted>
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
        <CardTitle>Valuation Multiples</CardTitle>
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
          <CardTitle>Valuation Analysis</CardTitle>
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
          <CardTitle>Analyst Target</CardTitle>
          <div className="target-analysis">
            <MetricCard
              label="Analyst Target"
              value={
                recommendation.targetPrice
                  ? `$${recommendation.targetPrice.toFixed(2)}`
                  : null
              }
            />
            <MetricCard
              label="Potential Upside"
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
        <CardTitle>Price Context</CardTitle>
        <div className="metrics-grid">
          {recommendation && (
            <>
              <MetricCard
                label="52W High"
                value={
                  recommendation.fiftyTwoWeekHigh
                    ? `$${recommendation.fiftyTwoWeekHigh.toFixed(2)}`
                    : null
                }
                tooltip={
                  <InfoTooltip text="**52W Maximum** | Nejvyšší cena za poslední rok." />
                }
              />
              <MetricCard
                label="52W Low"
                value={
                  recommendation.fiftyTwoWeekLow
                    ? `$${recommendation.fiftyTwoWeekLow.toFixed(2)}`
                    : null
                }
                tooltip={
                  <InfoTooltip text="**52W Minimum** | Nejnižší cena za poslední rok." />
                }
              />
              <MetricCard
                label="Distance from 52W High"
                value={
                  recommendation.distanceFrom52wHigh !== null
                    ? `${recommendation.distanceFrom52wHigh.toFixed(1)}% below`
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
      verdict = 'Undervalued';
      sentiment = 'positive';
      description = `P/E of ${f.peRatio.toFixed(
        1
      )} suggests potential undervaluation. Compare with sector average.`;
    } else if (f.peRatio < 20) {
      verdict = 'Fair Value';
      sentiment = 'neutral';
      description = `P/E of ${f.peRatio.toFixed(
        1
      )} is in the typical range for established companies.`;
    } else if (f.peRatio < 35) {
      verdict = 'Growth Premium';
      sentiment = 'neutral';
      description = `P/E of ${f.peRatio.toFixed(
        1
      )} reflects growth expectations. Verify with earnings growth.`;
    } else {
      verdict = 'Expensive';
      sentiment = 'negative';
      description = `P/E of ${f.peRatio.toFixed(
        1
      )} is elevated. Requires strong growth to justify.`;
    }

    methods.push({ name: 'P/E Analysis', verdict, description, sentiment });
  }

  // PEG Analysis
  if (f.pegRatio !== null && f.pegRatio > 0) {
    let verdict: string;
    let sentiment: 'positive' | 'negative' | 'neutral';
    let description: string;

    if (f.pegRatio < 1) {
      verdict = 'Undervalued';
      sentiment = 'positive';
      description = `PEG of ${f.pegRatio.toFixed(
        2
      )} under 1 suggests price doesn't fully reflect growth.`;
    } else if (f.pegRatio < 1.5) {
      verdict = 'Fair Value';
      sentiment = 'neutral';
      description = `PEG of ${f.pegRatio.toFixed(
        2
      )} indicates balanced valuation vs growth.`;
    } else {
      verdict = 'Expensive';
      sentiment = 'negative';
      description = `PEG of ${f.pegRatio.toFixed(
        2
      )} over 1.5 suggests premium pricing.`;
    }

    methods.push({ name: 'PEG Analysis', verdict, description, sentiment });
  }

  // EV/EBITDA Analysis
  if (f.evEbitda !== null && f.evEbitda > 0) {
    let verdict: string;
    let sentiment: 'positive' | 'negative' | 'neutral';
    let description: string;

    if (f.evEbitda < 8) {
      verdict = 'Undervalued';
      sentiment = 'positive';
      description = `EV/EBITDA of ${f.evEbitda.toFixed(
        1
      )} is below average. Could signal opportunity.`;
    } else if (f.evEbitda < 14) {
      verdict = 'Fair Value';
      sentiment = 'neutral';
      description = `EV/EBITDA of ${f.evEbitda.toFixed(
        1
      )} is in typical range.`;
    } else {
      verdict = 'Premium';
      sentiment = 'negative';
      description = `EV/EBITDA of ${f.evEbitda.toFixed(
        1
      )} is above average. Premium valuation.`;
    }

    methods.push({
      name: 'EV/EBITDA Analysis',
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
