import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset body overflow after each test
    document.body.style.overflow = '';
  });

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
    });

    it('renders title', () => {
      render(<Modal {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(
        <Modal {...defaultProps}>
          <p>Child content here</p>
        </Modal>
      );
      expect(screen.getByText('Child content here')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(<Modal {...defaultProps} />);
      expect(
        screen.getByRole('button', { name: /close/i })
      ).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies medium size class by default', () => {
      render(<Modal {...defaultProps} />);
      const modal = screen.getByText('Test Modal').closest('.modal');
      expect(modal).toHaveClass('modal-md');
    });

    it('applies small size class', () => {
      render(<Modal {...defaultProps} size="sm" />);
      const modal = screen.getByText('Test Modal').closest('.modal');
      expect(modal).toHaveClass('modal-sm');
    });

    it('applies large size class', () => {
      render(<Modal {...defaultProps} size="lg" />);
      const modal = screen.getByText('Test Modal').closest('.modal');
      expect(modal).toHaveClass('modal-lg');
    });
  });

  describe('closing behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      const overlay = document.querySelector('.modal-overlay');
      if (overlay) {
        await user.click(overlay);
      }
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByText('Modal content'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose for other keys', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('body overflow', () => {
    it('sets body overflow to hidden when modal opens', () => {
      render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('resets body overflow when modal closes', () => {
      const { rerender } = render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');
    });

    it('resets body overflow on unmount', () => {
      const { unmount } = render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('accessibility', () => {
    it('close button has aria-label', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /close/i })).toHaveAttribute(
        'aria-label',
        'Close'
      );
    });
  });

  describe('event cleanup', () => {
    it('removes keydown listener on unmount', () => {
      const onClose = vi.fn();
      const { unmount } = render(<Modal {...defaultProps} onClose={onClose} />);

      unmount();

      // After unmount, keydown should not trigger onClose
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
