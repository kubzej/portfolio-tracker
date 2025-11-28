import { cn } from '@/utils/cn';
import './Tabs.css';

export interface TabOption {
  value: string;
  label: string;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  options: TabOption[];
  disabled?: boolean;
  className?: string;
}

export function Tabs({
  value,
  onChange,
  options,
  disabled,
  className,
}: TabsProps) {
  return (
    <div className={cn('tabs', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn('tab-btn', value === option.value && 'active')}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
