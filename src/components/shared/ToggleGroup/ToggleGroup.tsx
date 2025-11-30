import { cn } from '@/utils/cn';
import { Count } from '@/components/shared/Typography';
import './ToggleGroup.css';

export interface ToggleOption {
  value: string;
  label: string;
  /** Optional count to display next to label */
  count?: number;
  /** Optional color variant for the option */
  color?:
    | 'default'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'purple'
    | 'cyan'
    | 'orange';
}

interface ToggleGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: ToggleOption[];
  /** Visual variant - 'transaction' adds buy/sell colors, 'signal' adds signal colors */
  variant?: 'default' | 'transaction' | 'signal';
  /** Size variant */
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  /** Hide options with count === 0 (only applies when count is provided) */
  hideEmpty?: boolean;
}

export function ToggleGroup({
  value,
  onChange,
  options,
  variant = 'default',
  size = 'md',
  disabled,
  className,
  hideEmpty = false,
}: ToggleGroupProps) {
  const filteredOptions = hideEmpty
    ? options.filter((opt) => opt.count === undefined || opt.count > 0)
    : options;

  return (
    <div
      className={cn(
        'toggle-group',
        `toggle-group--${variant}`,
        `toggle-group--${size}`,
        className
      )}
    >
      {filteredOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'toggle-option',
            value === option.value && 'active',
            variant === 'transaction' &&
              `toggle-option--${option.value.toLowerCase()}`,
            variant === 'signal' &&
              option.color &&
              `toggle-option--${option.color}`
          )}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
          {option.count !== undefined && <Count>{option.count}</Count>}
        </button>
      ))}
    </div>
  );
}
