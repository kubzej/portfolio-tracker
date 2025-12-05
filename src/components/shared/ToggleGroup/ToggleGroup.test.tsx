import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleGroup, ToggleOption } from './ToggleGroup';

describe('ToggleGroup', () => {
  const defaultOptions: ToggleOption[] = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  const defaultProps = {
    value: 'option1',
    onChange: vi.fn(),
    options: defaultOptions,
  };

  describe('rendering', () => {
    it('renders all options', () => {
      render(<ToggleGroup {...defaultProps} />);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('renders buttons for each option', () => {
      render(<ToggleGroup {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('applies toggle-group class', () => {
      const { container } = render(<ToggleGroup {...defaultProps} />);
      expect(container.querySelector('.toggle-group')).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('marks current value as active', () => {
      render(<ToggleGroup {...defaultProps} value="option2" />);
      const option2Button = screen.getByText('Option 2').closest('button');
      expect(option2Button).toHaveClass('active');
    });

    it('does not mark other options as active', () => {
      render(<ToggleGroup {...defaultProps} value="option1" />);
      const option2Button = screen.getByText('Option 2').closest('button');
      const option3Button = screen.getByText('Option 3').closest('button');
      expect(option2Button).not.toHaveClass('active');
      expect(option3Button).not.toHaveClass('active');
    });
  });

  describe('interaction', () => {
    it('calls onChange with correct value when option is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ToggleGroup {...defaultProps} onChange={onChange} />);

      await user.click(screen.getByText('Option 2'));
      expect(onChange).toHaveBeenCalledWith('option2');
    });

    it('does not call onChange when disabled', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<ToggleGroup {...defaultProps} onChange={onChange} disabled />);

      await user.click(screen.getByText('Option 2'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('variants', () => {
    it('applies default variant class', () => {
      const { container } = render(<ToggleGroup {...defaultProps} />);
      expect(
        container.querySelector('.toggle-group--default')
      ).toBeInTheDocument();
    });

    it('applies transaction variant class', () => {
      const { container } = render(
        <ToggleGroup {...defaultProps} variant="transaction" />
      );
      expect(
        container.querySelector('.toggle-group--transaction')
      ).toBeInTheDocument();
    });

    it('applies signal variant class', () => {
      const { container } = render(
        <ToggleGroup {...defaultProps} variant="signal" />
      );
      expect(
        container.querySelector('.toggle-group--signal')
      ).toBeInTheDocument();
    });

    it('applies transaction option class for buy/sell', () => {
      const transactionOptions: ToggleOption[] = [
        { value: 'buy', label: 'Buy' },
        { value: 'sell', label: 'Sell' },
      ];
      render(
        <ToggleGroup
          {...defaultProps}
          options={transactionOptions}
          variant="transaction"
          value="buy"
        />
      );
      const buyButton = screen.getByText('Buy').closest('button');
      expect(buyButton).toHaveClass('toggle-option--buy');
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      const { container } = render(<ToggleGroup {...defaultProps} />);
      expect(container.querySelector('.toggle-group--md')).toBeInTheDocument();
    });

    it('applies small size', () => {
      const { container } = render(<ToggleGroup {...defaultProps} size="sm" />);
      expect(container.querySelector('.toggle-group--sm')).toBeInTheDocument();
    });
  });

  describe('counts', () => {
    it('renders count when provided', () => {
      const optionsWithCount: ToggleOption[] = [
        { value: 'option1', label: 'Option 1', count: 5 },
        { value: 'option2', label: 'Option 2', count: 10 },
      ];
      render(<ToggleGroup {...defaultProps} options={optionsWithCount} />);
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('renders count of 0', () => {
      const optionsWithZero: ToggleOption[] = [
        { value: 'option1', label: 'Option 1', count: 0 },
      ];
      render(<ToggleGroup {...defaultProps} options={optionsWithZero} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('hideEmpty', () => {
    it('shows options with count 0 by default', () => {
      const optionsWithZero: ToggleOption[] = [
        { value: 'option1', label: 'Option 1', count: 5 },
        { value: 'option2', label: 'Option 2', count: 0 },
      ];
      render(<ToggleGroup {...defaultProps} options={optionsWithZero} />);
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('hides options with count 0 when hideEmpty is true', () => {
      const optionsWithZero: ToggleOption[] = [
        { value: 'option1', label: 'Option 1', count: 5 },
        { value: 'option2', label: 'Option 2', count: 0 },
      ];
      render(
        <ToggleGroup {...defaultProps} options={optionsWithZero} hideEmpty />
      );
      expect(screen.queryByText('Option 2')).not.toBeInTheDocument();
    });

    it('shows options without count property even when hideEmpty is true', () => {
      const mixedOptions: ToggleOption[] = [
        { value: 'option1', label: 'Option 1', count: 5 },
        { value: 'option2', label: 'Option 2' }, // no count
      ];
      render(
        <ToggleGroup {...defaultProps} options={mixedOptions} hideEmpty />
      );
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });
  });

  describe('className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <ToggleGroup {...defaultProps} className="custom-toggle" />
      );
      expect(container.querySelector('.custom-toggle')).toBeInTheDocument();
    });
  });

  describe('color option', () => {
    it('applies color class for signal variant', () => {
      const optionsWithColor: ToggleOption[] = [
        { value: 'option1', label: 'Option 1', color: 'success' },
        { value: 'option2', label: 'Option 2', color: 'danger' },
      ];
      render(
        <ToggleGroup
          {...defaultProps}
          options={optionsWithColor}
          variant="signal"
          value="option1"
        />
      );
      const option1Button = screen.getByText('Option 1').closest('button');
      expect(option1Button).toHaveClass('toggle-option--success');
    });
  });

  describe('disabled state', () => {
    it('disables all buttons when disabled', () => {
      render(<ToggleGroup {...defaultProps} disabled />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
