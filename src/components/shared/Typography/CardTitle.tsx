import './Typography.css';

interface CardTitleProps {
  children: React.ReactNode;
}

/**
 * Title within a card (h4 equivalent)
 */
export function CardTitle({ children }: CardTitleProps) {
  return <h4 className="card-title">{children}</h4>;
}
