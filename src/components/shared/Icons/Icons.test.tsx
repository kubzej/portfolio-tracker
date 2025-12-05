import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EditIcon, TrashIcon } from './Icons';

describe('Icons', () => {
  describe('EditIcon', () => {
    it('renders svg element', () => {
      const { container } = render(<EditIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies custom size', () => {
      const { container } = render(<EditIcon size={24} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '24');
      expect(svg).toHaveAttribute('height', '24');
    });

    it('applies custom className', () => {
      const { container } = render(<EditIcon className="custom" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('custom');
    });
  });

  describe('TrashIcon', () => {
    it('renders svg element', () => {
      const { container } = render(<TrashIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies custom size', () => {
      const { container } = render(<TrashIcon size={20} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
    });
  });
});
