import './Typography.css';

type TextElement = 'span' | 'p' | 'div';

interface TextProps {
  children: React.ReactNode;
  as?: TextElement;
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted' | 'success' | 'danger';
}

export function Text({
  children,
  as: Component = 'span',
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

  return <Component className={classes}>{children}</Component>;
}
