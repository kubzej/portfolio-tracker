import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  describe('rendering', () => {
    it('renders spinner element', () => {
      const { container } = render(<LoadingSpinner />);
      expect(container.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('does not render text by default', () => {
      render(<LoadingSpinner />);
      expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
    });

    it('renders text when provided', () => {
      render(<LoadingSpinner text="Loading data..." />);
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies medium size by default', () => {
      const { container } = render(<LoadingSpinner />);
      expect(
        container.querySelector('.loading-spinner--md')
      ).toBeInTheDocument();
    });

    it('applies small size', () => {
      const { container } = render(<LoadingSpinner size="sm" />);
      expect(
        container.querySelector('.loading-spinner--sm')
      ).toBeInTheDocument();
    });

    it('applies large size', () => {
      const { container } = render(<LoadingSpinner size="lg" />);
      expect(
        container.querySelector('.loading-spinner--lg')
      ).toBeInTheDocument();
    });
  });

  describe('fullPage mode', () => {
    it('renders inline container by default', () => {
      const { container } = render(<LoadingSpinner />);
      expect(
        container.querySelector('.loading-spinner-inline')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.loading-spinner-container')
      ).not.toBeInTheDocument();
    });

    it('renders full page container when fullPage is true', () => {
      const { container } = render(<LoadingSpinner fullPage />);
      expect(
        container.querySelector('.loading-spinner-container')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.loading-spinner-inline')
      ).not.toBeInTheDocument();
    });
  });

  describe('combined props', () => {
    it('renders all props together', () => {
      const { container } = render(
        <LoadingSpinner size="lg" text="Please wait..." fullPage />
      );
      expect(
        container.querySelector('.loading-spinner--lg')
      ).toBeInTheDocument();
      expect(screen.getByText('Please wait...')).toBeInTheDocument();
      expect(
        container.querySelector('.loading-spinner-container')
      ).toBeInTheDocument();
    });
  });
});
