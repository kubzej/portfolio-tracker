import type { SignalType } from '@/utils/recommendations';
import { SIGNAL_CONFIG } from '@/utils/signals';
import { Badge } from '../Typography';

// Map signal class to Badge variant
const CLASS_TO_VARIANT: Record<
  string,
  | 'dip'
  | 'momentum'
  | 'conviction'
  | 'quality'
  | 'target'
  | 'trim'
  | 'watch'
  | 'accumulate'
  | 'hold'
  | 'neutral'
> = {
  dip: 'dip',
  momentum: 'momentum',
  conviction: 'conviction',
  quality: 'quality',
  target: 'target',
  trim: 'trim',
  watch: 'watch',
  accumulate: 'accumulate',
  hold: 'hold',
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
