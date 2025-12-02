import { MetricLabel, MetricValue, Text, Description } from '../Typography';
import { InfoTooltip } from '../InfoTooltip';
import './TrendSignal.css';

export type TrendType = 'bullish' | 'bearish' | 'neutral';

interface TrendSignalProps {
  signal: string;
  description: string;
  type: TrendType;
}

export function TrendSignal({ signal, description, type }: TrendSignalProps) {
  return (
    <div className={`trend-signal-box ${type}`}>
      <Text size="lg" weight="semibold">
        {signal}
      </Text>
      <Description>{description}</Description>
    </div>
  );
}

interface MACardProps {
  label: string;
  value: number | null;
  vsValue?: number | null;
  vsLabel?: string;
  crossSignal?: 'golden' | 'death' | null;
  tooltip?: string;
}

export function MACard({
  label,
  value,
  vsValue,
  vsLabel,
  crossSignal,
  tooltip,
}: MACardProps) {
  const isAbove = vsValue !== null && vsValue !== undefined && vsValue >= 0;

  return (
    <div className="ma-card-item">
      <div className="ma-card-header">
        <MetricLabel>{label}</MetricLabel>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <MetricValue size="lg">
        {value !== null ? value.toFixed(2) : '—'}
      </MetricValue>
      {vsValue !== null && vsValue !== undefined && (
        <div className={`ma-vs-value ${isAbove ? 'above' : 'below'}`}>
          <Text size="sm" color={isAbove ? 'success' : 'danger'}>
            {isAbove ? '↑' : '↓'} {Math.abs(vsValue).toFixed(1)}%{vsLabel}
          </Text>
        </div>
      )}
      {crossSignal && (
        <div className={`ma-cross-signal ${crossSignal}`}>
          <Text size="sm" weight="medium">
            {crossSignal === 'golden' ? 'Zlatý kříž' : 'Smrtící kříž'}
          </Text>
        </div>
      )}
    </div>
  );
}

interface MACardsRowProps {
  children: React.ReactNode;
}

export function MACardsRow({ children }: MACardsRowProps) {
  return <div className="ma-cards-row">{children}</div>;
}
