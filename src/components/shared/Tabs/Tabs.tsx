import { cn } from '@/utils/cn';
import { Button } from '@/components/shared/Button';
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
        <Button
          key={option.value}
          variant="ghost"
          size="md"
          className="tab-btn"
          isActive={value === option.value}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
