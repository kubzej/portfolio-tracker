import type { SignalType } from '@/utils/recommendations';
import { SIGNAL_CONFIG } from '@/utils/signals';
import { Badge } from '../Typography';

// Map signal class to Badge variant
type BadgeVariant =
  | 'dip'
  | 'breakout'
  | 'reversal'
  | 'momentum'
  | 'accumulate'
  | 'good-entry'
  | 'wait'
  | 'target'
  | 'take-profit'
  | 'trim'
  | 'hold'
  | 'fundamentally-weak'
  | 'technically-weak'
  | 'problematic'
  | 'conviction'
  | 'quality'
  | 'undervalued'
  | 'strong-trend'
  | 'steady'
  | 'watch'
  | 'overbought'
  | 'weak'
  | 'neutral';

// Keys match the 'class' property in SIGNAL_CONFIG (signals.ts)
const CLASS_TO_VARIANT: Record<string, BadgeVariant> = {
  dip: 'dip',
  breakout: 'breakout',
  reversal: 'reversal',
  momentum: 'momentum',
  accumulate: 'accumulate',
  'good-entry': 'good-entry',
  wait: 'wait',
  target: 'target',
  'take-profit': 'take-profit',
  trim: 'trim',
  hold: 'hold',
  'fundamentally-weak': 'fundamentally-weak',
  'technically-weak': 'technically-weak',
  problematic: 'problematic',
  conviction: 'conviction',
  quality: 'quality',
  undervalued: 'undervalued',
  'strong-trend': 'strong-trend',
  steady: 'steady',
  watch: 'watch',
  overbought: 'overbought',
  weak: 'weak',
  neutral: 'neutral',
};

interface SignalBadgeProps {
  type: SignalType;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

export function SignalBadge({
  type,
  size = 'md',
  showTooltip = false,
}: SignalBadgeProps) {
  const config = SIGNAL_CONFIG[type] || SIGNAL_CONFIG.NEUTRAL;
  const variant = CLASS_TO_VARIANT[config.class] || 'neutral';
  const badgeSize = size === 'sm' ? 'xs' : 'sm';

  return (
    <Badge
      variant={variant}
      size={badgeSize}
      title={showTooltip ? config.description : undefined}
    >
      {config.label}
    </Badge>
  );
}
