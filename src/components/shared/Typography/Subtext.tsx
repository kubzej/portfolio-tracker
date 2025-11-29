import './Typography.css';

interface SubtextProps {
  children: React.ReactNode;
}

export function Subtext({ children }: SubtextProps) {
  return <span className="subtext">{children}</span>;
}
