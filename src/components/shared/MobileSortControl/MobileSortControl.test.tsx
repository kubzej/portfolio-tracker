import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileSortControl, SortField } from './MobileSortControl';

describe('MobileSortControl', () => {
  const fields: SortField[] = [
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Date' },
  ];

  it('renders with default label', () => {
    render(
      <MobileSortControl
        fields={fields}
        selectedField="name"
        direction="asc"
        onFieldChange={vi.fn()}
        onDirectionChange={vi.fn()}
      />
    );
    expect(screen.getByText('Řadit podle')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(
      <MobileSortControl
        label="Sort by"
        fields={fields}
        selectedField="name"
        direction="asc"
        onFieldChange={vi.fn()}
        onDirectionChange={vi.fn()}
      />
    );
    expect(screen.getByText('Sort by')).toBeInTheDocument();
  });

  it('renders container', () => {
    const { container } = render(
      <MobileSortControl
        fields={fields}
        selectedField="name"
        direction="asc"
        onFieldChange={vi.fn()}
        onDirectionChange={vi.fn()}
      />
    );
    expect(container.querySelector('.mobile-sort-control')).toBeInTheDocument();
  });
});
