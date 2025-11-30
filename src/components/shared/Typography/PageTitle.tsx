import './Typography.css';

interface PageTitleProps {
  children: React.ReactNode;
}

/**
 * Main page title (h1 equivalent)
 */
export function PageTitle({ children }: PageTitleProps) {
  return <h1 className="page-title">{children}</h1>;
}
