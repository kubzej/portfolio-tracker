import './Typography.css';

interface LabelProps {
  children: React.ReactNode;
  size?: 'sm' | 'base';
  htmlFor?: string;
}

/**
 * Generic label - NOT uppercase (use MetricLabel for uppercase labels)
 * Can be used as form label with htmlFor prop
 */
export function Label({ children, size = 'sm', htmlFor }: LabelProps) {
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={`label label--${size}`}>
        {children}
      </label>
    );
  }
  return <span className={`label label--${size}`}>{children}</span>;
}
