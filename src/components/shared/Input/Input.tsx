import { InputHTMLAttributes, forwardRef } from 'react';
import './Input.css';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input size variant */
  inputSize?: 'sm' | 'md' | 'lg';
  /** Full width input */
  fullWidth?: boolean;
  /** Error state */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      inputSize = 'md',
      fullWidth = false,
      error = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const classes = [
      'input',
      `input-${inputSize}`,
      fullWidth && 'input-full',
      error && 'input-error',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return <input ref={ref} className={classes} {...props} />;
  }
);

Input.displayName = 'Input';
