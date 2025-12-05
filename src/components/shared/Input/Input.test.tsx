import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  describe('rendering', () => {
    it('renders input element', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    it('renders with value', () => {
      render(<Input value="test value" readOnly />);
      expect(screen.getByDisplayValue('test value')).toBeInTheDocument();
    });

    it('renders with type', () => {
      render(<Input type="email" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
    });
  });

  describe('sizes', () => {
    it('applies small size class', () => {
      render(<Input inputSize="sm" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('input-sm');
    });

    it('applies medium size class by default', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('input-md');
    });

    it('applies large size class', () => {
      render(<Input inputSize="lg" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('input-lg');
    });
  });

  describe('fullWidth', () => {
    it('does not apply full width class by default', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).not.toHaveClass('input-full');
    });

    it('applies full width class when fullWidth is true', () => {
      render(<Input fullWidth data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('input-full');
    });
  });

  describe('error state', () => {
    it('does not apply error class by default', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).not.toHaveClass('input-error');
    });

    it('applies error class when error is true', () => {
      render(<Input error data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('input-error');
    });
  });

  describe('custom className', () => {
    it('appends custom className', () => {
      render(<Input className="custom-class" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('input');
      expect(input).toHaveClass('custom-class');
    });
  });

  describe('disabled state', () => {
    it('is not disabled by default', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).not.toBeDisabled();
    });

    it('is disabled when disabled prop is true', () => {
      render(<Input disabled data-testid="input" />);
      expect(screen.getByTestId('input')).toBeDisabled();
    });
  });

  describe('interaction', () => {
    it('calls onChange when typing', async () => {
      const user = userEvent.setup();
      let value = '';
      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        value = e.target.value;
      };

      render(<Input onChange={handleChange} data-testid="input" />);
      await user.type(screen.getByTestId('input'), 'hello');
      expect(value).toBe('hello');
    });

    it('calls onFocus when focused', async () => {
      const user = userEvent.setup();
      let focused = false;
      const handleFocus = () => {
        focused = true;
      };

      render(<Input onFocus={handleFocus} data-testid="input" />);
      await user.click(screen.getByTestId('input'));
      expect(focused).toBe(true);
    });

    it('calls onBlur when blurred', async () => {
      const user = userEvent.setup();
      let blurred = false;
      const handleBlur = () => {
        blurred = true;
      };

      render(<Input onBlur={handleBlur} data-testid="input" />);
      await user.click(screen.getByTestId('input'));
      await user.tab();
      expect(blurred).toBe(true);
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = { current: null as HTMLInputElement | null };
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('combined props', () => {
    it('applies all props together correctly', () => {
      render(
        <Input
          inputSize="lg"
          fullWidth
          error
          className="my-input"
          placeholder="Type here"
          data-testid="input"
        />
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveClass('input');
      expect(input).toHaveClass('input-lg');
      expect(input).toHaveClass('input-full');
      expect(input).toHaveClass('input-error');
      expect(input).toHaveClass('my-input');
      expect(input).toHaveAttribute('placeholder', 'Type here');
    });
  });
});
