import './Typography.css';

interface TextProps {
  children: React.ReactNode;
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted';
}

export function Text({
  children,
  size = 'base',
  weight = 'normal',
  color = 'primary',
}: TextProps) {
  const classes = [
    'text',
    `text--${size}`,
    `text--${weight}`,
    `text--${color}`,
  ].join(' ');

  return <span className={classes}>{children}</span>;
}
