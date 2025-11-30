import { Button } from '../Button';
import { CardTitle, Description } from '../Typography';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <CardTitle>{title}</CardTitle>
      {description && (
        <div className="empty-state-description">
          <Description>{description}</Description>
        </div>
      )}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
