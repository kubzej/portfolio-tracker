import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSortable, createSortOptions } from './useSortable';

interface TestItem {
  id: number;
  name: string;
  value: number;
}

const testData: TestItem[] = [
  { id: 1, name: 'Apple', value: 100 },
  { id: 2, name: 'Banana', value: 50 },
  { id: 3, name: 'Cherry', value: 75 },
];

const valueExtractor = (item: TestItem, field: 'name' | 'value') => {
  switch (field) {
    case 'name':
      return item.name;
    case 'value':
      return item.value;
    default:
      return null;
  }
};

describe('useSortable', () => {
  describe('initial state', () => {
    it('returns default field and direction', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, { defaultField: 'name' })
      );

      expect(result.current.sortField).toBe('name');
      expect(result.current.sortDirection).toBe('asc');
    });

    it('uses custom default direction', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'value',
          defaultDirection: 'desc',
        })
      );

      expect(result.current.sortField).toBe('value');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('returns sortValue combining field and direction', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'name',
          defaultDirection: 'desc',
        })
      );

      expect(result.current.sortValue).toBe('name-desc');
    });
  });

  describe('sortedData', () => {
    it('sorts strings ascending', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'name',
          defaultDirection: 'asc',
        })
      );

      expect(result.current.sortedData.map((i) => i.name)).toEqual([
        'Apple',
        'Banana',
        'Cherry',
      ]);
    });

    it('sorts strings descending', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'name',
          defaultDirection: 'desc',
        })
      );

      expect(result.current.sortedData.map((i) => i.name)).toEqual([
        'Cherry',
        'Banana',
        'Apple',
      ]);
    });

    it('sorts numbers ascending', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'value',
          defaultDirection: 'asc',
        })
      );

      expect(result.current.sortedData.map((i) => i.value)).toEqual([
        50, 75, 100,
      ]);
    });

    it('sorts numbers descending', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'value',
          defaultDirection: 'desc',
        })
      );

      expect(result.current.sortedData.map((i) => i.value)).toEqual([
        100, 75, 50,
      ]);
    });

    it('handles null values by pushing to end', () => {
      const dataWithNull: TestItem[] = [
        { id: 1, name: 'Apple', value: 100 },
        { id: 2, name: 'Banana', value: 50 },
      ];
      const extractorWithNull = (item: TestItem, field: string) => {
        if (field === 'name' && item.id === 2) return null;
        return field === 'name' ? item.name : item.value;
      };

      const { result } = renderHook(() =>
        useSortable(dataWithNull, extractorWithNull, {
          defaultField: 'name',
          defaultDirection: 'asc',
        })
      );

      // Null should be at the end
      expect(result.current.sortedData[1].id).toBe(2);
    });
  });

  describe('handleSort', () => {
    it('toggles direction when clicking same field', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'name',
          defaultDirection: 'asc',
        })
      );

      act(() => {
        result.current.handleSort('name');
      });

      expect(result.current.sortDirection).toBe('desc');

      act(() => {
        result.current.handleSort('name');
      });

      expect(result.current.sortDirection).toBe('asc');
    });

    it('changes to new field with default direction desc', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'name',
          defaultDirection: 'asc',
        })
      );

      act(() => {
        result.current.handleSort('name');
      });

      expect(result.current.sortField).toBe('name');
      expect(result.current.sortDirection).toBe('desc'); // toggles from asc to desc
    });

    it('changes to ascending field with asc direction', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'value',
          ascendingFields: ['name'],
        })
      );

      act(() => {
        result.current.handleSort('name');
      });

      expect(result.current.sortField).toBe('name');
      expect(result.current.sortDirection).toBe('asc');
    });
  });

  describe('setSort', () => {
    it('sets field and direction directly', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, { defaultField: 'name' })
      );

      act(() => {
        result.current.setSort('name', 'desc');
      });

      expect(result.current.sortField).toBe('name');
      expect(result.current.sortDirection).toBe('desc');
    });
  });

  describe('setSortFromValue', () => {
    it('parses sort value string', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, { defaultField: 'name' })
      );

      act(() => {
        result.current.setSortFromValue('value-desc');
      });

      expect(result.current.sortField).toBe('value');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('handles field names with dashes', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, { defaultField: 'name' })
      );

      act(() => {
        result.current.setSortFromValue('some-field-name-asc');
      });

      expect(result.current.sortField).toBe('some-field-name');
      expect(result.current.sortDirection).toBe('asc');
    });
  });

  describe('getSortIndicator', () => {
    it('returns indicator for current sort field', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, {
          defaultField: 'name',
          defaultDirection: 'asc',
        })
      );

      const indicator = result.current.getSortIndicator('name');
      expect(indicator).not.toBeNull();
    });

    it('returns null for non-sorted field', () => {
      const { result } = renderHook(() =>
        useSortable<TestItem, 'name' | 'value'>(testData, valueExtractor, {
          defaultField: 'name',
        })
      );

      const indicator = result.current.getSortIndicator('value');
      expect(indicator).toBeNull();
    });
  });

  describe('isSorted', () => {
    it('returns true for current sort field', () => {
      const { result } = renderHook(() =>
        useSortable(testData, valueExtractor, { defaultField: 'name' })
      );

      expect(result.current.isSorted('name')).toBe(true);
    });

    it('returns false for other fields', () => {
      const { result } = renderHook(() =>
        useSortable<TestItem, 'name' | 'value'>(testData, valueExtractor, {
          defaultField: 'name',
        })
      );

      expect(result.current.isSorted('value')).toBe(false);
    });
  });

  describe('data updates', () => {
    it('re-sorts when data changes', () => {
      const { result, rerender } = renderHook(
        ({ data }) =>
          useSortable(data, valueExtractor, {
            defaultField: 'value',
            defaultDirection: 'asc',
          }),
        { initialProps: { data: testData } }
      );

      expect(result.current.sortedData[0].value).toBe(50);

      const newData: TestItem[] = [
        ...testData,
        { id: 4, name: 'Date', value: 25 },
      ];

      rerender({ data: newData });

      expect(result.current.sortedData[0].value).toBe(25);
    });
  });
});

describe('createSortOptions', () => {
  it('creates options for both directions by default', () => {
    const options = createSortOptions([{ field: 'name', label: 'Name' }]);

    expect(options).toEqual([
      { value: 'name-asc', label: 'Name (A-Z)' },
      { value: 'name-desc', label: 'Name (Z-A)' },
    ]);
  });

  it('creates options for specified directions', () => {
    const options = createSortOptions([
      { field: 'value', label: 'Value', directions: ['desc'] },
    ]);

    expect(options).toEqual([{ value: 'value-desc', label: 'Value (Z-A)' }]);
  });

  it('creates options for multiple fields', () => {
    const options = createSortOptions([
      { field: 'name', label: 'Name' },
      { field: 'value', label: 'Value' },
    ]);

    expect(options).toHaveLength(4);
    expect(options[0].value).toBe('name-asc');
    expect(options[2].value).toBe('value-asc');
  });
});
