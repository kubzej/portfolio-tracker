import './Typography.css';

type BadgeVariant =
  // Recommendation
  | 'buy'
  | 'sell'
  | 'hold'
  // Sentiment
  | 'positive'
  | 'negative'
  | 'neutral'
  // General
  | 'info'
  | 'warning'
  // Signals
  | 'dip'
  | 'momentum'
  | 'conviction'
  | 'target'
  | 'trim'
  | 'watch'
  | 'accumulate';

type BadgeSize = 'xs' | 'sm' | 'base' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant: BadgeVariant;
  size?: BadgeSize;
  title?: string;
}

export function Badge({ children, variant, size = 'base', title }: BadgeProps) {
  return (
    <span className={`badge badge--${size} badge--${variant}`} title={title}>
      {children}
    </span>
  );
}
