import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabOption } from './Tabs';

describe('Tabs', () => {
  const defaultOptions: TabOption[] = [
    { value: 'tab1', label: 'Tab 1' },
    { value: 'tab2', label: 'Tab 2' },
    { value: 'tab3', label: 'Tab 3' },
  ];

  const defaultProps = {
    value: 'tab1',
    onChange: vi.fn(),
    options: defaultOptions,
  };

  describe('rendering', () => {
    it('renders all tab options', () => {
      render(<Tabs {...defaultProps} />);
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });

    it('renders tabs container with correct class', () => {
      const { container } = render(<Tabs {...defaultProps} />);
      expect(container.querySelector('.tabs')).toBeInTheDocument();
    });

    it('renders buttons for each option', () => {
      render(<Tabs {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });
  });

  describe('active state', () => {
    it('marks current value as active', () => {
      render(<Tabs {...defaultProps} value="tab2" />);
      const tab2Button = screen.getByText('Tab 2');
      expect(tab2Button).toHaveClass('active');
    });

    it('does not mark other tabs as active', () => {
      render(<Tabs {...defaultProps} value="tab1" />);
      const tab2Button = screen.getByText('Tab 2');
      const tab3Button = screen.getByText('Tab 3');
      expect(tab2Button).not.toHaveClass('active');
      expect(tab3Button).not.toHaveClass('active');
    });
  });

  describe('interaction', () => {
    it('calls onChange with correct value when tab is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs {...defaultProps} onChange={onChange} />);

      await user.click(screen.getByText('Tab 2'));
      expect(onChange).toHaveBeenCalledWith('tab2');
    });

    it('calls onChange for each tab click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs {...defaultProps} onChange={onChange} />);

      await user.click(screen.getByText('Tab 1'));
      expect(onChange).toHaveBeenCalledWith('tab1');

      await user.click(screen.getByText('Tab 3'));
      expect(onChange).toHaveBeenCalledWith('tab3');
    });
  });

  describe('disabled state', () => {
    it('disables all tabs when disabled is true', () => {
      render(<Tabs {...defaultProps} disabled />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('does not call onChange when disabled', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Tabs {...defaultProps} onChange={onChange} disabled />);

      await user.click(screen.getByText('Tab 2'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <Tabs {...defaultProps} className="custom-tabs" />
      );
      const tabsContainer = container.querySelector('.tabs');
      expect(tabsContainer).toHaveClass('custom-tabs');
    });
  });

  describe('edge cases', () => {
    it('handles empty options array', () => {
      const { container } = render(
        <Tabs {...defaultProps} options={[]} value="" />
      );
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(0);
    });

    it('handles single option', () => {
      render(
        <Tabs
          {...defaultProps}
          options={[{ value: 'only', label: 'Only Tab' }]}
          value="only"
        />
      );
      expect(screen.getByText('Only Tab')).toBeInTheDocument();
    });

    it('handles value not in options', () => {
      render(<Tabs {...defaultProps} value="nonexistent" />);
      // All tabs should render without active state
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).not.toHaveClass('active');
      });
    });
  });
});
