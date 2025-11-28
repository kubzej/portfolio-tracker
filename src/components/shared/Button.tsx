import { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isActive?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  isActive = false,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${
        isActive ? 'active' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
