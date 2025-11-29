import './Typography.css';

interface RecItemProps {
  children: React.ReactNode;
  type: 'buy' | 'hold' | 'sell';
}

export function RecItem({ children, type }: RecItemProps) {
  return <span className={`rec-item rec-item--${type}`}>{children}</span>;
}
