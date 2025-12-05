import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomSheet, BottomSheetOption } from './BottomSheet';

describe('BottomSheet', () => {
  it('renders title when open', () => {
    render(
      <BottomSheet isOpen={true} onClose={vi.fn()} title="Sheet Title">
        <div>Content</div>
      </BottomSheet>
    );
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <BottomSheet isOpen={true} onClose={vi.fn()} title="Test">
        <div>Sheet content</div>
      </BottomSheet>
    );
    expect(screen.getByText('Sheet content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <BottomSheet isOpen={false} onClose={vi.fn()} title="Hidden">
        <div>Hidden content</div>
      </BottomSheet>
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});

describe('BottomSheetOption', () => {
  it('renders option label', () => {
    render(<BottomSheetOption label="Option" onClick={vi.fn()} />);
    expect(screen.getByText('Option')).toBeInTheDocument();
  });
});
