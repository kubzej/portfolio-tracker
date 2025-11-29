import './Typography.css';

interface HintProps {
  children: React.ReactNode;
}

/**
 * Helper text / hint (form hints, tooltips, etc.)
 */
export function Hint({ children }: HintProps) {
  return <span className="hint">{children}</span>;
}
