import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('rendering', () => {
    it('renders title', () => {
      render(<EmptyState title="No items found" />);
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('renders container with empty-state class', () => {
      const { container } = render(<EmptyState title="No data" />);
      expect(container.querySelector('.empty-state')).toBeInTheDocument();
    });
  });

  describe('description', () => {
    it('does not render description when not provided', () => {
      const { container } = render(<EmptyState title="No data" />);
      expect(
        container.querySelector('.empty-state-description')
      ).not.toBeInTheDocument();
    });

    it('renders description when provided', () => {
      render(
        <EmptyState
          title="No items"
          description="Try adding some items to get started"
        />
      );
      expect(
        screen.getByText('Try adding some items to get started')
      ).toBeInTheDocument();
    });
  });

  describe('action', () => {
    it('does not render button when action not provided', () => {
      render(<EmptyState title="No data" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders action button when provided', () => {
      const action = {
        label: 'Add Item',
        onClick: vi.fn(),
      };
      render(<EmptyState title="No data" action={action} />);
      expect(
        screen.getByRole('button', { name: 'Add Item' })
      ).toBeInTheDocument();
    });

    it('calls onClick when action button is clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const action = {
        label: 'Add Item',
        onClick,
      };
      render(<EmptyState title="No data" action={action} />);

      await user.click(screen.getByRole('button', { name: 'Add Item' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('combined props', () => {
    it('renders all props together', () => {
      const action = {
        label: 'Get Started',
        onClick: vi.fn(),
      };
      render(
        <EmptyState
          title="Welcome"
          description="This is your first time here"
          action={action}
        />
      );

      expect(screen.getByText('Welcome')).toBeInTheDocument();
      expect(
        screen.getByText('This is your first time here')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Get Started' })
      ).toBeInTheDocument();
    });
  });
});
