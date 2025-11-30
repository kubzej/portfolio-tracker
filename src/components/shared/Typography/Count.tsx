import './Typography.css';

interface CountProps {
  children: React.ReactNode;
}

export function Count({ children }: CountProps) {
  return <span className="count">{children}</span>;
}
