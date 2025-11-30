import './Typography.css';

interface MutedProps {
  children: React.ReactNode;
}

export function Muted({ children }: MutedProps) {
  return <span className="muted-text">{children}</span>;
}
