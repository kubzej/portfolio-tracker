import './Typography.css';

type BadgeVariant =
  | 'buy'
  | 'sell'
  | 'hold'
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'info'
  | 'warning';
type BadgeSize = 'xs' | 'sm' | 'base';

interface BadgeProps {
  children: React.ReactNode;
  variant: BadgeVariant;
  size?: BadgeSize;
}

export function Badge({ children, variant, size = 'base' }: BadgeProps) {
  return (
    <span className={`badge badge--${size} badge--${variant}`}>{children}</span>
  );
}
