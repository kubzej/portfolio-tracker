import './Typography.css';

type TagVariant =
  | 'default'
  | 'success'
  | 'muted'
  | 'owned'
  | 'tracked'
  | 'custom';
type TagSize = 'xs' | 'sm';

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  size?: TagSize;
  title?: string;
  /** Custom background color (only used with variant='custom') */
  color?: string;
}

export function Tag({
  children,
  variant = 'default',
  size = 'sm',
  title,
  color,
}: TagProps) {
  const style =
    variant === 'custom' && color ? { backgroundColor: color } : undefined;

  return (
    <span
      className={`tag tag--${variant} tag--${size}`}
      title={title}
      style={style}
    >
      {children}
    </span>
  );
}
