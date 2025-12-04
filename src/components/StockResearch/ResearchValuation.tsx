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
              <InfoTooltip text="**Price-to-Earnings (P/E)** | Poměr ceny akcie k zisku na akcii. Říká, kolik dolarů platíte za každý dolar zisku firmy. | • Pod 15 = Akcie je levná (hodnotová investice) | • 15-25 = Férová cena (průměr trhu) | • Nad 25 = Akcie je drahá nebo se očekává velký růst | Nízké P/E může znamenat příležitost, ale i problémy firmy." />
            }
            sentiment={getPESentiment(f.peRatio)}
          />
          <MetricCard
            label="Forward P/E"
            value={f.forwardPe?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Forward P/E** | P/E vypočítané z očekávaných zisků na příštích 12 měsíců. Ukazuje, jak je akcie drahá vůči budoucnosti. | • Fwd P/E < P/E = Analytici čekají růst zisků (akcie 'zlevní') | • Fwd P/E > P/E = Analytici čekají pokles zisků (akcie 'zdraží')" />
            }
            sentiment={getPESentiment(f.forwardPe)}
          />
          <MetricCard
            label="PEG Ratio"
            value={f.pegRatio?.toFixed(3) ?? null}
            tooltip={
              <InfoTooltip text="**PEG Ratio** | P/E poměr upravený o růst zisků (P/E děleno růstem). | • Pod 1.0 = Akcie je levná vzhledem k tomu, jak rychle roste | • 1.0 - 1.5 = Férová cena | • Nad 2.0 = Akcie je drahá i přes svůj růst | Nejlepší ukazatel pro růstové firmy." />
            }
            sentiment={getPEGSentiment(f.pegRatio)}
          />
          <MetricCard
            label="P/B Ratio"
            value={f.pbRatio?.toFixed(3) ?? null}
            tooltip={
              <InfoTooltip text="**Price-to-Book (P/B)** | Poměr ceny akcie k účetní hodnotě majetku firmy (po odečtení dluhů). | • Pod 1.0 = Akcie se prodává pod cenou majetku (potenciálně podhodnocená) | • Nad 3.0 = Investoři platí za značku a know-how (běžné u tech firem) | Nízké P/B je typické pro banky a průmysl." />
            }
            sentiment={getPBSentiment(f.pbRatio)}
          />
          <MetricCard
            label="P/S Ratio"
            value={f.psRatio?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**Price-to-Sales (P/S)** | Poměr ceny akcie k tržbám na akcii. Říká, kolik platíte za každý dolar tržeb. | • Pod 2.0 = Levná akcie | • Nad 10.0 = Velmi drahá (bublina?) | Klíčový ukazatel pro firmy, které ještě nemají zisk (startupy, bio-tech)." />
            }
            sentiment={getPSSentiment(f.psRatio)}
          />
          <MetricCard
            label="EV/EBITDA"
            value={f.evEbitda?.toFixed(2) ?? null}
            tooltip={
              <InfoTooltip text="**EV/EBITDA** | Celková hodnota firmy (včetně dluhu) dělená provozním ziskem. Je to přesnější než P/E pro firmy s velkým dluhem. | • Pod 10 = Levná firma (možný cíl převzetí) | • 10-15 = Férové ocenění | • Nad 15 = Prémiová cena | Čím nižší, tím levnější firma je." />
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
