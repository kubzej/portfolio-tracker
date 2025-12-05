import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionSheetOption } from './ActionSheet';

// ActionSheet uses dialog.showModal() which is not supported in jsdom
// Only testing ActionSheetOption which doesn't have this limitation

describe('ActionSheetOption', () => {
  it('renders option label', () => {
    render(<ActionSheetOption label="Option 1" onClick={vi.fn()} />);
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('renders suffix when provided', () => {
    render(
      <ActionSheetOption label="Option" suffix="(Default)" onClick={vi.fn()} />
    );
    expect(screen.getByText('(Default)')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<ActionSheetOption label="Click me" onClick={onClick} />);
    screen.getByText('Click me').click();
    expect(onClick).toHaveBeenCalled();
  });
});
