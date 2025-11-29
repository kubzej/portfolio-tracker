import type { ReactNode } from 'react';
import { MetricLabel, MetricValue, Text } from '../Typography';
import { InfoTooltip } from '../InfoTooltip';
import './IndicatorValue.css';

export type IndicatorSentiment =
  | 'positive'
  | 'negative'
  | 'warning'
  | 'muted'
  | 'neutral'
  | 'overbought'
  | 'oversold';

interface IndicatorValueProps {
  label: string;
  value: string | number | null;
  sentiment?: IndicatorSentiment;
  tooltip?: string;
  suffix?: string;
}

export function IndicatorValue({
  label,
  value,
  sentiment = 'neutral',
  tooltip,
  suffix,
}: IndicatorValueProps) {
  // Map overbought/oversold to positive/negative for MetricValue
  const metricSentiment =
    sentiment === 'neutral' || sentiment === 'muted' || sentiment === 'warning'
      ? undefined
      : sentiment === 'overbought'
      ? 'negative'
      : sentiment === 'oversold'
      ? 'positive'
      : sentiment;

  return (
    <div className="indicator-value-item">
      <div className="indicator-value-label">
        <MetricLabel>{label}</MetricLabel>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className="indicator-value-content">
        <MetricValue sentiment={metricSentiment}>{value ?? '—'}</MetricValue>
        {suffix && (
          <Text size="sm" color="muted">
            {suffix}
          </Text>
        )}
      </div>
    </div>
  );
}

interface IndicatorValuesRowProps {
  children: ReactNode;
}

export function IndicatorValuesRow({ children }: IndicatorValuesRowProps) {
  return <div className="indicator-values-row">{children}</div>;
}

export type SignalType =
  | 'bullish'
  | 'bearish'
  | 'neutral'
  | 'overbought'
  | 'oversold'
  | 'high'
  | 'low'
  | 'normal'
  | 'strong'
  | 'moderate'
  | 'weak'
  | 'no-trend';

interface IndicatorSignalProps {
  type: SignalType | null;
  children: ReactNode;
  variant?: 'default' | 'divergence' | 'direction' | 'highlight';
}

export function IndicatorSignal({
  type,
  children,
  variant = 'default',
}: IndicatorSignalProps) {
  const getClassName = () => {
    const base = 'indicator-signal-badge';
    const typeClass = type || 'neutral';
    const variantClass = variant !== 'default' ? `variant-${variant}` : '';
    return `${base} ${typeClass} ${variantClass}`.trim();
  };

  return (
    <div className={getClassName()}>
      <Text size="base" weight="medium">
        {children}
      </Text>
    </div>
  );
}

interface ZoneBadgeProps {
  type: 'overbought' | 'neutral' | 'oversold';
  children: ReactNode;
}

export function ZoneBadge({ type, children }: ZoneBadgeProps) {
  return (
    <span className={`zone-badge-item ${type}`}>
      <Text size="xs">{children}</Text>
    </span>
  );
}

interface ZonesRowProps {
  children: ReactNode;
}

export function ZonesRow({ children }: ZonesRowProps) {
  return <div className="zones-row">{children}</div>;
}
