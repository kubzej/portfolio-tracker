import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  describe('basic usage', () => {
    it('returns empty string for no arguments', () => {
      expect(cn()).toBe('');
    });

    it('returns single class name', () => {
      expect(cn('foo')).toBe('foo');
    });

    it('joins multiple class names with space', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
      expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
    });
  });

  describe('falsy values', () => {
    it('filters out false', () => {
      expect(cn('foo', false, 'bar')).toBe('foo bar');
    });

    it('filters out null', () => {
      expect(cn('foo', null, 'bar')).toBe('foo bar');
    });

    it('filters out undefined', () => {
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('filters out empty string', () => {
      expect(cn('foo', '', 'bar')).toBe('foo bar');
    });

    it('filters out 0', () => {
      expect(cn('foo', 0, 'bar')).toBe('foo bar');
    });

    it('handles all falsy values together', () => {
      expect(cn(false, null, undefined, '', 0)).toBe('');
    });
  });

  describe('conditional classes', () => {
    it('includes class when condition is true', () => {
      const isActive = true;
      expect(cn('btn', isActive && 'btn-active')).toBe('btn btn-active');
    });

    it('excludes class when condition is false', () => {
      const isActive = false;
      expect(cn('btn', isActive && 'btn-active')).toBe('btn');
    });

    it('handles multiple conditions', () => {
      const isActive = true;
      const isDisabled = false;
      const isLarge = true;
      expect(
        cn(
          'btn',
          isActive && 'btn-active',
          isDisabled && 'btn-disabled',
          isLarge && 'btn-lg'
        )
      ).toBe('btn btn-active btn-lg');
    });
  });

  describe('numbers', () => {
    it('converts numbers to strings', () => {
      expect(cn('item', 1)).toBe('item 1');
      expect(cn('item', 42)).toBe('item 42');
    });

    it('excludes 0 as falsy', () => {
      expect(cn('item', 0)).toBe('item');
    });
  });

  describe('nested arrays', () => {
    it('flattens single level array', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('flattens nested arrays', () => {
      expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
    });

    it('handles mixed arrays with conditions', () => {
      const isActive = true;
      expect(cn(['foo', isActive && 'active', ['nested']])).toBe(
        'foo active nested'
      );
    });

    it('filters falsy values in arrays', () => {
      expect(cn(['foo', false, null, 'bar'])).toBe('foo bar');
    });

    it('handles deeply nested arrays', () => {
      expect(cn([['a', ['b', ['c']]]])).toBe('a b c');
    });

    it('handles empty arrays', () => {
      expect(cn([])).toBe('');
      expect(cn('foo', [], 'bar')).toBe('foo bar');
    });
  });

  describe('real-world usage patterns', () => {
    it('handles BEM-style class composition', () => {
      const variant = 'primary';
      const size = 'lg';
      expect(cn('btn', `btn--${variant}`, `btn--${size}`)).toBe(
        'btn btn--primary btn--lg'
      );
    });

    it('handles component variant classes', () => {
      const props = {
        variant: 'outline' as const,
        size: 'sm' as const,
        disabled: true,
        className: 'custom-class',
      };
      expect(
        cn(
          'button',
          `button-${props.variant}`,
          `button-${props.size}`,
          props.disabled && 'button-disabled',
          props.className
        )
      ).toBe('button button-outline button-sm button-disabled custom-class');
    });

    it('handles toggle group style composition', () => {
      const isActive = true;
      const variant = 'transaction';
      const optionValue = 'buy';
      expect(
        cn(
          'toggle-option',
          isActive && 'active',
          variant === 'transaction' && `toggle-option--${optionValue}`
        )
      ).toBe('toggle-option active toggle-option--buy');
    });
  });
});
