import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricRow } from './MetricRow';

describe('MetricRow', () => {
  it('renders label', () => {
    render(<MetricRow label="Test Label" value={100} />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('renders numeric value', () => {
    render(<MetricRow label="Price" value={100} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<MetricRow label="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders dash for null value', () => {
    render(<MetricRow label="Empty" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders with suffix', () => {
    render(<MetricRow label="Change" value={5} suffix="%" />);
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  it('renders with prefix', () => {
    render(<MetricRow label="Price" value={100} prefix="$" />);
    expect(screen.getByText('$100')).toBeInTheDocument();
  });
});
