import type { SignalType } from '@/utils/recommendations';
import { SIGNAL_CONFIG } from '@/utils/signals';
import './SignalBadge.css';

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

  return (
    <span
      className={`signal-badge signal-badge--${config.class} signal-badge--${size}`}
      title={showTooltip ? config.description : undefined}
    >
      {config.label}
    </span>
  );
}
