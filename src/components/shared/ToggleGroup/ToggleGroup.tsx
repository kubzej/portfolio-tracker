import './ToggleGroup.css';

export interface ToggleOption {
  value: string;
  label: string;
}

interface ToggleGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: ToggleOption[];
  disabled?: boolean;
  className?: string;
}

export function ToggleGroup({
  value,
  onChange,
  options,
  disabled,
  className = '',
}: ToggleGroupProps) {
  return (
    <div className={`toggle-group ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`toggle-option ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
