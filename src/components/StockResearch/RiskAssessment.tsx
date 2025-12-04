import type { FundamentalMetrics } from '@/services/api/analysis';
import { InfoTooltip } from '@/components/shared';
import {
  CardTitle,
  Badge,
  Text,
  MetricLabel,
} from '@/components/shared/Typography';
import './RiskAssessment.css';

interface RiskAssessmentProps {
  fundamentals: FundamentalMetrics | null;
  volatilityPercent?: number | null; // ATR as % if available
}

type RiskLevel = 'low' | 'moderate' | 'moderate-high' | 'high';

interface RiskData {
  beta: number | null;
  riskLevel: RiskLevel;
  riskFactors: string[];
}

function calculateRisk(
  fundamentals: FundamentalMetrics | null,
  volatilityPercent?: number | null
): RiskData {
  const beta = fundamentals?.beta ?? null;
  const riskFactors: string[] = [];

  // Determine risk level based on beta
  let riskLevel: RiskLevel = 'moderate';

  if (beta !== null) {
    if (beta > 1.5) {
      riskLevel = 'high';
      riskFactors.push('Vysoká beta (volatilita výrazně nad trhem)');
    } else if (beta > 1.2) {
      riskLevel = 'moderate-high';
      riskFactors.push('Vyšší volatilita než trh');
    } else if (beta < 0.7) {
      riskLevel = 'low';
      riskFactors.push('Nízká beta (defenzivní akcie)');
    }
  }

  // Check debt levels
  const debtToEquity = fundamentals?.debtToEquity;
  if (debtToEquity !== null && debtToEquity !== undefined) {
    if (debtToEquity > 2) {
      riskFactors.push('Vysoké zadlužení');
      if (riskLevel === 'moderate') riskLevel = 'moderate-high';
    } else if (debtToEquity < 0.3) {
      riskFactors.push('Nízké zadlužení');
    }
  }

  // Check profitability
  const netMargin = fundamentals?.netMargin;
  if (netMargin !== null && netMargin !== undefined) {
    if (netMargin < 0) {
      riskFactors.push('Záporná marže (ztrátová)');
      if (riskLevel !== 'high') riskLevel = 'moderate-high';
    } else if (netMargin < 5) {
      riskFactors.push('Nízká ziskovost');
    }
  }

  // Check volatility
  if (volatilityPercent !== null && volatilityPercent !== undefined) {
    if (volatilityPercent > 4) {
      riskFactors.push('Vysoká denní volatilita');
    }
  }

  // Check current ratio
  const currentRatio = fundamentals?.currentRatio;
  if (currentRatio !== null && currentRatio !== undefined && currentRatio < 1) {
    riskFactors.push('Nízká likvidita (current ratio < 1)');
    if (riskLevel === 'moderate' || riskLevel === 'low')
      riskLevel = 'moderate-high';
  }

  // If no risk factors, add a neutral one
  if (riskFactors.length === 0) {
    riskFactors.push('Průměrný rizikový profil');
  }

  return {
    beta,
    riskLevel,
    riskFactors,
  };
}

function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'Nízké';
    case 'moderate':
      return 'Střední';
    case 'moderate-high':
      return 'Střední až vysoké';
    case 'high':
      return 'Vysoké';
  }
}

function getRiskLevelVariant(
  level: RiskLevel
): 'buy' | 'hold' | 'sell' | 'info' {
  switch (level) {
    case 'low':
      return 'buy';
    case 'moderate':
      return 'hold';
    case 'moderate-high':
      return 'sell';
    case 'high':
      return 'sell';
  }
}

export function RiskAssessment({
  fundamentals,
  volatilityPercent,
}: RiskAssessmentProps) {
  const risk = calculateRisk(fundamentals, volatilityPercent);

  return (
    <section className="risk-assessment">
      <CardTitle>
        Riziková analýza
        <InfoTooltip text="**Riziková analýza** | Hodnocení bezpečnosti investice. | • Nízké riziko = Stabilní firma, malé výkyvy | • Vysoké riziko = Velké výkyvy, dluhy nebo ztráta | Vhodné pro konzervativní investory." />
      </CardTitle>

      <div className="risk-assessment__content">
        <div className="risk-assessment__level">
          <Text color="secondary">Úroveň rizika</Text>
          <Badge variant={getRiskLevelVariant(risk.riskLevel)}>
            {getRiskLevelLabel(risk.riskLevel)}
          </Badge>
        </div>

        {risk.riskFactors.length > 0 && (
          <div className="risk-assessment__reasons">
            <MetricLabel>Důvody</MetricLabel>
            <ul className="risk-assessment__factors">
              {risk.riskFactors.map((factor, i) => (
                <li key={i}>{factor}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
