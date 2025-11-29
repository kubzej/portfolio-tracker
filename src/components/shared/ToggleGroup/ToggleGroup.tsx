import { cn } from '@/utils/cn';
import './ToggleGroup.css';

export interface ToggleOption {
  value: string;
  label: string;
}

interface ToggleGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: ToggleOption[];
  /** Visual variant - 'transaction' adds buy/sell colors */
  variant?: 'default' | 'transaction';
  disabled?: boolean;
  className?: string;
}

export function ToggleGroup({
  value,
  onChange,
  options,
  variant = 'default',
  disabled,
  className,
}: ToggleGroupProps) {
  return (
    <div className={cn('toggle-group', `toggle-group--${variant}`, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'toggle-option',
            value === option.value && 'active',
            variant === 'transaction' &&
              `toggle-option--${option.value.toLowerCase()}`
          )}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
