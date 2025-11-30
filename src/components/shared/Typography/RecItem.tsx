import './Typography.css';

interface RecItemProps {
  children: React.ReactNode;
  variant: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
  title?: string;
}

export function RecItem({ children, variant, title }: RecItemProps) {
  return (
    <span className={`rec-item rec-item--${variant}`} title={title}>
      {children}
    </span>
  );
}
