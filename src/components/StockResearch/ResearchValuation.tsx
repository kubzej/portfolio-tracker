import type { FundamentalMetrics } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { InfoTooltip } from '@/components/shared';
import { cn } from '@/utils/cn';
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
        <div className="no-data">No valuation data available</div>
      </div>
    );
  }

  // Calculate fair value estimates based on different methods
  const valuationMethods = calculateValuationMethods(f);

  return (
    <div className="research-valuation">
      {/* Valuation Multiples */}
      <section className="valuation-section">
        <h3 className="section-title">Valuation Multiples</h3>
        <div className="metrics-grid">
          <ValuationMetric
            label="P/E Ratio"
            value={f.peRatio?.toFixed(2) ?? null}
            tooltip="Poměr ceny k zisku. Kolik korun platíte za 1 korunu ročního zisku. Nižší = levnější, ale záleží na odvětví."
            sentiment={getPESentiment(f.peRatio)}
          />
          <ValuationMetric
            label="Forward P/E"
            value={f.forwardPe?.toFixed(2) ?? null}
            tooltip="P/E na základě očekávaných zisků. Lépe odráží budoucí potenciál než historické P/E."
            sentiment={getPESentiment(f.forwardPe)}
          />
          <ValuationMetric
            label="PEG Ratio"
            value={f.pegRatio?.toFixed(3) ?? null}
            tooltip="P/E dělené růstem zisku. Pod 1 = podhodnoceno vzhledem k růstu, nad 2 = drahé."
            sentiment={getPEGSentiment(f.pegRatio)}
          />
          <ValuationMetric
            label="P/B Ratio"
            value={f.pbRatio?.toFixed(3) ?? null}
            tooltip="Poměr ceny k účetní hodnotě. Pod 1 = akcie se obchoduje pod hodnotou aktiv (může být příležitost)."
            sentiment={getPBSentiment(f.pbRatio)}
          />
          <ValuationMetric
            label="P/S Ratio"
            value={f.psRatio?.toFixed(2) ?? null}
            tooltip="Poměr ceny k tržbám. Užitečné pro firmy bez zisku. Pod 2 je levné, nad 10 drahé."
            sentiment={getPSSentiment(f.psRatio)}
          />
          <ValuationMetric
            label="EV/EBITDA"
            value={f.evEbitda?.toFixed(2) ?? null}
            tooltip="Hodnota firmy / provozní zisk. Lepší pro srovnání firem s různým zadlužením. Pod 10 je atraktivní."
            sentiment={getEVEBITDASentiment(f.evEbitda)}
          />
        </div>
      </section>

      {/* Valuation Analysis */}
      {valuationMethods.length > 0 && (
        <section className="valuation-section">
          <h3 className="section-title">Valuation Analysis</h3>
          <div className="valuation-analysis">
            {valuationMethods.map((method) => (
              <div key={method.name} className="valuation-method">
                <div className="method-header">
                  <span className="method-name">{method.name}</span>
                  <span className={cn('method-verdict', method.sentiment)}>
                    {method.verdict}
                  </span>
                </div>
                <p className="method-description">{method.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Target Price Analysis */}
      {recommendation && recommendation.targetUpside !== null && (
        <section className="valuation-section">
          <h3 className="section-title">Analyst Target</h3>
          <div className="target-analysis">
            <div className="target-price">
              <span className="label">Analyst Target</span>
              <span className="value">
                {recommendation.targetPrice
                  ? `$${recommendation.targetPrice.toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <div className="target-upside">
              <span className="label">Potential Upside</span>
              <span
                className={cn(
                  'value',
                  recommendation.targetUpside > 0 ? 'positive' : 'negative'
                )}
              >
                {recommendation.targetUpside > 0 ? '+' : ''}
                {recommendation.targetUpside.toFixed(1)}%
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 52-Week Context */}
      <section className="valuation-section">
        <h3 className="section-title">Price Context</h3>
        <div className="metrics-grid">
          {recommendation && (
            <>
              <ValuationMetric
                label="52W High"
                value={
                  recommendation.fiftyTwoWeekHigh
                    ? `$${recommendation.fiftyTwoWeekHigh.toFixed(2)}`
                    : null
                }
                tooltip="Nejvyšší cena za posledních 52 týdnů."
              />
              <ValuationMetric
                label="52W Low"
                value={
                  recommendation.fiftyTwoWeekLow
                    ? `$${recommendation.fiftyTwoWeekLow.toFixed(2)}`
                    : null
                }
                tooltip="Nejnižší cena za posledních 52 týdnů."
              />
              <ValuationMetric
                label="Distance from 52W High"
                value={
                  recommendation.distanceFrom52wHigh !== null
                    ? `${recommendation.distanceFrom52wHigh.toFixed(1)}% below`
                    : null
                }
                tooltip="Jak daleko je aktuální cena od 52týdenního maxima. Větší odstup může signalizovat příležitost."
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

// Valuation Metric component - label on top, value below
interface ValuationMetricProps {
  value: string | null;
  label: string;
  tooltip?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

function ValuationMetric({
  value,
  label,
  tooltip,
  sentiment,
}: ValuationMetricProps) {
  return (
    <div className="valuation-metric">
      <span className="valuation-metric-label">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className={cn('valuation-metric-value', sentiment)}>
        {value ?? '—'}
      </span>
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
