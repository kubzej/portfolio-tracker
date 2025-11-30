import './Typography.css';

interface StockNameProps {
  children: React.ReactNode;
  size?: 'sm' | 'base' | 'lg';
  truncate?: boolean;
}

export function StockName({
  children,
  size = 'base',
  truncate = false,
}: StockNameProps) {
  const classes = [
    'stock-name',
    `stock-name--${size}`,
    truncate && 'stock-name--truncate',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}
