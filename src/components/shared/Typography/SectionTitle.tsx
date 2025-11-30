import './Typography.css';

interface SectionTitleProps {
  children: React.ReactNode;
}

/**
 * Section title within a page (h3 equivalent)
 */
export function SectionTitle({ children }: SectionTitleProps) {
  return <h3 className="section-title">{children}</h3>;
}
