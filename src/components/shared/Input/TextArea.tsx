import { TextareaHTMLAttributes, forwardRef } from 'react';
import './TextArea.css';

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** TextArea size variant */
  inputSize?: 'sm' | 'md' | 'lg';
  /** Full width textarea */
  fullWidth?: boolean;
  /** Error state */
  error?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      inputSize = 'md',
      fullWidth = false,
      error = false,
      className = '',
      rows = 3,
      ...props
    },
    ref
  ) => {
    const classes = [
      'textarea',
      `textarea-${inputSize}`,
      fullWidth && 'textarea-full',
      error && 'textarea-error',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return <textarea ref={ref} className={classes} rows={rows} {...props} />;
  }
);

TextArea.displayName = 'TextArea';
