import './Typography.css';

interface DescriptionProps {
  children: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'base';
}

/**
 * Descriptive text paragraph
 */
export function Description({ children, size = 'base' }: DescriptionProps) {
  return <p className={`description description-${size}`}>{children}</p>;
}
