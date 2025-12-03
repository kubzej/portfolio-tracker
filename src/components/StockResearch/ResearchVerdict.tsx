import type { StockRecommendation } from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import { SignalBadge, InfoTooltip } from '@/components/shared';
import { CardTitle, Text, MetricLabel } from '@/components/shared/Typography';
import './ResearchVerdict.css';

interface ResearchVerdictProps {
  recommendation: StockRecommendation;
  onAddToWatchlist?: () => void;
  onTrack?: () => void;
  isTracked?: boolean;
  trackLoading?: boolean;
}

type Verdict = 'good-entry' | 'wait' | 'pass' | 'insufficient-data';
type Confidence = 'high' | 'medium' | 'low';

interface VerdictResult {
  verdict: Verdict;
  confidence: Confidence;
  title: string;
  description: string;
  reasons: string[];
}

/**
 * Determine research verdict based on recommendation data
 */
function calculateVerdict(rec: StockRecommendation): VerdictResult {
  const reasons: string[] = [];

  // Check for insufficient data
  const hasPrice = rec.currentPrice > 0;
  const hasScores = rec.compositeScore > 0;

  if (!hasPrice || !hasScores) {
    return {
      verdict: 'insufficient-data',
      confidence: 'low',
      title: 'Nedostatek dat',
      description: 'Pro tuto akcii nemáme dostatek dat k vyhodnocení.',
      reasons: ['Chybí cenová data nebo analytické skóre'],
    };
  }

  // Calculate verdict
  const goodFundamentals = rec.fundamentalScore >= 55;
  const goodTechnical =
    rec.technicalBias === 'BULLISH' || rec.technicalScore >= 50;
  const goodAnalyst = rec.analystScore >= 50;
  const hasUpside = (rec.targetUpside ?? 0) > 10;
  const highConviction = rec.convictionScore >= 60;
  const isOversold = rec.dipScore >= 40;

  // GOOD ENTRY conditions
  if (rec.compositeScore >= 60 && (hasUpside || isOversold) && goodTechnical) {
    if (goodFundamentals) reasons.push('Silné fundamenty');
    if (goodTechnical) reasons.push('Příznivá technická situace');
    if (hasUpside)
      reasons.push(`Upside k cíli analytiků ${rec.targetUpside?.toFixed(0)}%`);
    if (isOversold) reasons.push('Akcie v přeprodané zóně');
    if (highConviction) reasons.push('Vysoká kvalita pro dlouhodobé držení');

    const confidence: Confidence =
      rec.compositeScore >= 70 && highConviction
        ? 'high'
        : rec.compositeScore >= 60
        ? 'medium'
        : 'low';

    return {
      verdict: 'good-entry',
      confidence,
      title: 'Dobrý vstup',
      description: 'Kvalitní akcie s příznivou cenou pro nákup.',
      reasons,
    };
  }

  // WAIT conditions - good stock but timing not ideal
  if (rec.compositeScore >= 50 && goodFundamentals) {
    if (rec.technicalBias === 'BEARISH') {
      reasons.push('Technicky v sestupném trendu');
    }
    if (rec.technicalScore < 40) {
      reasons.push('Slabé technické indikátory');
    }
    if ((rec.targetUpside ?? 0) < 5) {
      reasons.push('Nízký upside k cílové ceně');
    }
    if (!isOversold && rec.technicalBias !== 'BULLISH') {
      reasons.push('Čekejte na lepší vstupní bod');
    }

    return {
      verdict: 'wait',
      confidence: rec.compositeScore >= 55 ? 'medium' : 'low',
      title: 'Počkat',
      description: 'Zajímavá akcie, ale počkejte na lepší vstupní příležitost.',
      reasons,
    };
  }

  // PASS conditions
  if (!goodFundamentals) reasons.push('Slabé fundamenty');
  if (!goodAnalyst) reasons.push('Negativní konsenzus analytiků');
  if (rec.technicalBias === 'BEARISH') reasons.push('Medvědí technický výhled');
  if ((rec.targetUpside ?? 0) < 0) reasons.push('Cena nad cílem analytiků');
  if (rec.convictionScore < 40)
    reasons.push('Nízká kvalita pro dlouhodobé držení');

  return {
    verdict: 'pass',
    confidence: rec.compositeScore < 40 ? 'high' : 'medium',
    title: 'Vynechat',
    description: 'Tato akcie nesplňuje kritéria pro nákup.',
    reasons,
  };
}

export function ResearchVerdict({
  recommendation,
  onAddToWatchlist,
  onTrack,
  isTracked,
  trackLoading,
}: ResearchVerdictProps) {
  const verdictResult = calculateVerdict(recommendation);

  const verdictClass = cn(
    'research-verdict',
    `verdict--${verdictResult.verdict}`
  );

  return (
    <div className={verdictClass}>
      <div className="research-verdict__header">
        <CardTitle>
          Verdikt
          <InfoTooltip text="Celkové zhodnocení akcie pro nákup. | • Dobrý vstup = vhodný čas na nákup | • Počkat = čekat na lepší příležitost | • Nezajímavé = aktuálně nedoporučeno" />
        </CardTitle>
        <div className="research-verdict__actions">
          {onTrack && (
            <button
              className={cn(
                'research-verdict__track-btn',
                isTracked && 'research-verdict__track-btn--active'
              )}
              onClick={onTrack}
              type="button"
              disabled={trackLoading}
              title={isTracked ? 'Přestat sledovat' : 'Přidat do sledování'}
            >
              {trackLoading ? '...' : isTracked ? '✓ Sledováno' : '+ Sledovat'}
            </button>
          )}
          {onAddToWatchlist && (
            <button
              className="research-verdict__watchlist-btn"
              onClick={onAddToWatchlist}
              type="button"
            >
              + Watchlist
            </button>
          )}
        </div>
      </div>

      <div className="research-verdict__content">
        <div className="research-verdict__main">
          <div className="research-verdict__signal">
            {recommendation.primarySignal && (
              <SignalBadge type={recommendation.primarySignal.type} size="md" />
            )}
          </div>
          <div className="research-verdict__info">
            <Text size="lg" weight="semibold">
              {verdictResult.title}
            </Text>
            <Text size="sm" color="secondary">
              {verdictResult.description}
            </Text>
          </div>
        </div>

        {verdictResult.reasons.length > 0 && (
          <div className="research-verdict__reasons">
            <MetricLabel>Důvody</MetricLabel>
            <ul className="research-verdict__reasons-list">
              {verdictResult.reasons.slice(0, 4).map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
