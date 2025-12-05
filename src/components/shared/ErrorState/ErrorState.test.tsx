import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  describe('rendering', () => {
    it('renders error message', () => {
      render(<ErrorState message="Something went wrong" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders container with error-state class', () => {
      const { container } = render(<ErrorState message="Error" />);
      expect(container.querySelector('.error-state')).toBeInTheDocument();
    });

    it('renders error icon', () => {
      const { container } = render(<ErrorState message="Error" />);
      expect(container.querySelector('.error-state-icon')).toBeInTheDocument();
      expect(container.querySelector('.error-state-icon')).toHaveTextContent(
        '!'
      );
    });
  });

  describe('retry button', () => {
    it('does not render retry button when onRetry not provided', () => {
      render(<ErrorState message="Error" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', () => {
      render(<ErrorState message="Error" onRetry={vi.fn()} />);
      expect(
        screen.getByRole('button', { name: /zkusit znovu/i })
      ).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(<ErrorState message="Error" onRetry={onRetry} />);

      await user.click(screen.getByRole('button', { name: /zkusit znovu/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('message display', () => {
    it('displays long error messages', () => {
      const longMessage =
        'This is a very long error message that explains in detail what went wrong with the operation';
      render(<ErrorState message={longMessage} />);
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('displays technical error messages', () => {
      render(<ErrorState message="Error 500: Internal Server Error" />);
      expect(
        screen.getByText('Error 500: Internal Server Error')
      ).toBeInTheDocument();
    });
  });
});
