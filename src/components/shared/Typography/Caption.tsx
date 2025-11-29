import './Typography.css';

interface CaptionProps {
  children: React.ReactNode;
}

/**
 * Small descriptive text, typically below other elements
 */
export function Caption({ children }: CaptionProps) {
  return <span className="caption">{children}</span>;
}
