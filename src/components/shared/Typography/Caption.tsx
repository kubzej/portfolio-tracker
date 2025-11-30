import { cn } from '@/utils/cn';
import './Typography.css';

interface CaptionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Small descriptive text, typically below other elements
 */
export function Caption({ children, className }: CaptionProps) {
  return <span className={cn('caption', className)}>{children}</span>;
}
