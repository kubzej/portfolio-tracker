import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Text,
  Title,
  Label,
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Muted,
  Description,
  Tag,
} from './index';

describe('Typography', () => {
  describe('Text', () => {
    it('renders text content', () => {
      render(<Text>Hello World</Text>);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
  });

  describe('Title', () => {
    it('renders title', () => {
      render(<Title>Page Title</Title>);
      expect(screen.getByText('Page Title')).toBeInTheDocument();
    });
  });

  describe('Label', () => {
    it('renders label', () => {
      render(<Label>Form Label</Label>);
      expect(screen.getByText('Form Label')).toBeInTheDocument();
    });
  });

  describe('Ticker', () => {
    it('renders ticker', () => {
      render(<Ticker>AAPL</Ticker>);
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
  });

  describe('StockName', () => {
    it('renders stock name', () => {
      render(<StockName>Apple Inc.</StockName>);
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    });
  });

  describe('MetricLabel', () => {
    it('renders metric label', () => {
      render(<MetricLabel>P/E Ratio</MetricLabel>);
      expect(screen.getByText('P/E Ratio')).toBeInTheDocument();
    });
  });

  describe('MetricValue', () => {
    it('renders metric value', () => {
      render(<MetricValue>123.45</MetricValue>);
      expect(screen.getByText('123.45')).toBeInTheDocument();
    });
  });

  describe('Muted', () => {
    it('renders muted text', () => {
      render(<Muted>N/A</Muted>);
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('Description', () => {
    it('renders description', () => {
      render(<Description>Some description text</Description>);
      expect(screen.getByText('Some description text')).toBeInTheDocument();
    });
  });

  describe('Tag', () => {
    it('renders tag', () => {
      render(<Tag>Technology</Tag>);
      expect(screen.getByText('Technology')).toBeInTheDocument();
    });
  });
});
