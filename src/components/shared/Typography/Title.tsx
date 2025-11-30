import './Typography.css';

interface TitleProps {
  children: React.ReactNode;
  size?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span';
}

export function Title({
  children,
  size = 'lg',
  as: Component = 'span',
}: TitleProps) {
  return <Component className={`title title--${size}`}>{children}</Component>;
}
