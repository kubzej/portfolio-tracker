import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoTooltip, stripTooltipMarkdown } from './InfoTooltip';

describe('InfoTooltip', () => {
  it('renders tooltip container', () => {
    const { container } = render(<InfoTooltip text="Test tooltip" />);
    expect(container.querySelector('.info-tooltip')).toBeInTheDocument();
  });

  it('renders with text prop', () => {
    const { container } = render(<InfoTooltip text="Tooltip content" />);
    expect(container.querySelector('.info-tooltip')).toBeInTheDocument();
  });

  it('renders with children', () => {
    const { container } = render(
      <InfoTooltip>
        <span>Custom content</span>
      </InfoTooltip>
    );
    expect(container.querySelector('.info-tooltip')).toBeInTheDocument();
  });
});

describe('stripTooltipMarkdown', () => {
  it('removes bold markers', () => {
    expect(stripTooltipMarkdown('This is **bold** text')).toBe(
      'This is bold text'
    );
  });

  it('replaces pipe with space', () => {
    expect(stripTooltipMarkdown('Line 1 | Line 2')).toBe('Line 1 Line 2');
  });

  it('replaces newlines with space', () => {
    expect(stripTooltipMarkdown('Line 1\nLine 2')).toBe('Line 1 Line 2');
  });

  it('removes bullet points', () => {
    expect(stripTooltipMarkdown('• Item 1 • Item 2')).toBe('Item 1 Item 2');
  });

  it('collapses multiple spaces', () => {
    expect(stripTooltipMarkdown('Too   many    spaces')).toBe(
      'Too many spaces'
    );
  });

  it('handles combined markdown', () => {
    expect(stripTooltipMarkdown('**Bold** text\n• Bullet | pipe')).toBe(
      'Bold text Bullet pipe'
    );
  });
});
