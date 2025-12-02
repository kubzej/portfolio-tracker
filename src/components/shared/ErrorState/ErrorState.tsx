import { Button } from '../Button';
import { Text } from '../Typography';
import './ErrorState.css';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state-icon">!</div>
      <Text color="danger">{message}</Text>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Zkusit znovu
        </Button>
      )}
    </div>
  );
}
