import './Typography.css';

type TagVariant = 'default' | 'success' | 'muted';
type TagSize = 'xs' | 'sm';

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  size?: TagSize;
  title?: string;
}

export function Tag({
  children,
  variant = 'default',
  size = 'sm',
  title,
}: TagProps) {
  return (
    <span className={`tag tag--${variant} tag--${size}`} title={title}>
      {children}
    </span>
  );
}
