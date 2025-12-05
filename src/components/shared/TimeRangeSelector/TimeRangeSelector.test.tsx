import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TimeRangeSelector,
  TIME_RANGES_SHORT,
  TIME_RANGES_LONG,
  getDaysForRange,
} from './TimeRangeSelector';

describe('TimeRangeSelector', () => {
  it('renders all range options', () => {
    render(
      <TimeRangeSelector
        value="1M"
        onChange={vi.fn()}
        ranges={TIME_RANGES_SHORT}
      />
    );
    expect(screen.getByText('1W')).toBeInTheDocument();
    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
  });

  it('marks selected range as active', () => {
    render(<TimeRangeSelector value="3M" onChange={vi.fn()} />);
    const activeButton = screen.getByText('3M').closest('button');
    expect(activeButton).toHaveClass('active');
  });

  it('calls onChange when range is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeRangeSelector value="1M" onChange={onChange} />);

    await user.click(screen.getByText('3M'));
    expect(onChange).toHaveBeenCalledWith('3M');
  });
});

describe('getDaysForRange', () => {
  it('returns correct days for 1W', () => {
    expect(getDaysForRange('1W')).toBe(5);
  });

  it('returns correct days for 1M', () => {
    expect(getDaysForRange('1M')).toBe(21);
  });

  it('returns correct days for 1Y', () => {
    expect(getDaysForRange('1Y')).toBe(252);
  });
});

describe('TIME_RANGES constants', () => {
  it('TIME_RANGES_SHORT has 6 options', () => {
    expect(TIME_RANGES_SHORT).toHaveLength(6);
  });

  it('TIME_RANGES_LONG has 4 options', () => {
    expect(TIME_RANGES_LONG).toHaveLength(4);
  });
});
