import './Typography.css';

interface TickerProps {
  children: React.ReactNode;
  size?: 'sm' | 'base' | 'lg' | 'xl';
}

export function Ticker({ children, size = 'base' }: TickerProps) {
  return <span className={`ticker ticker--${size}`}>{children}</span>;
}
