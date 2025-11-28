import React, { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  value: string; // format: "field-direction" e.g. "ticker-asc"
  label: string;
}

export interface SortConfig<K extends string = string> {
  field: K;
  direction: SortDirection;
}

export interface UseSortableOptions<K extends string> {
  defaultField: K;
  defaultDirection?: SortDirection;
  /** Fields that should default to 'asc' when first clicked (e.g., 'ticker') */
  ascendingFields?: readonly K[];
}

export interface UseSortableReturn<T, K extends string> {
  sortField: K;
  sortDirection: SortDirection;
  sortValue: string;
  handleSort: (field: K) => void;
  setSort: (field: K, direction: SortDirection) => void;
  setSortFromValue: (value: string) => void;
  sortedData: T[];
  getSortIndicator: (field: K) => React.ReactNode;
  isSorted: (field: K) => boolean;
}

type SortValueExtractor<T, K extends string> = (
  item: T,
  field: K
) => string | number | null | undefined;

/**
 * Generic hook for sorting data with consistent behavior across components.
 *
 * @param data - Array of items to sort
 * @param valueExtractor - Function to extract sortable value from item by field
 * @param options - Configuration options
 *
 * @example
 * const { sortedData, handleSort, getSortIndicator, sortField, sortDirection } = useSortable(
 *   items,
 *   (item, field) => {
 *     switch (field) {
 *       case 'ticker': return item.ticker;
 *       case 'price': return item.price;
 *       default: return null;
 *     }
 *   },
 *   { defaultField: 'ticker', ascendingFields: ['ticker'] }
 * );
 */
export function useSortable<T, K extends string>(
  data: T[],
  valueExtractor: SortValueExtractor<T, K>,
  options: UseSortableOptions<K>
): UseSortableReturn<T, K> {
  const {
    defaultField,
    defaultDirection = 'asc',
    ascendingFields = [],
  } = options;

  const [sortField, setSortField] = useState<K>(defaultField);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(defaultDirection);

  const handleSort = useCallback(
    (field: K) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        // Default to 'asc' for text fields, 'desc' for numeric
        setSortDirection(ascendingFields.includes(field) ? 'asc' : 'desc');
      }
    },
    [sortField, ascendingFields]
  );

  const setSort = useCallback((field: K, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const setSortFromValue = useCallback((value: string) => {
    const lastDashIndex = value.lastIndexOf('-');
    if (lastDashIndex > 0) {
      const field = value.substring(0, lastDashIndex) as K;
      const direction = value.substring(lastDashIndex + 1) as SortDirection;
      setSortField(field);
      setSortDirection(direction);
    }
  }, []);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = valueExtractor(a, sortField);
      const bVal = valueExtractor(b, sortField);

      // Handle nulls - push to end
      if (aVal === null || aVal === undefined) {
        if (bVal === null || bVal === undefined) return 0;
        return 1;
      }
      if (bVal === null || bVal === undefined) return -1;

      // Compare strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Compare numbers
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [data, sortField, sortDirection, valueExtractor]);

  const getSortIndicator = useCallback(
    (field: K): React.ReactNode => {
      if (sortField !== field) return null;
      return (
        <span className="sort-indicator">
          {sortDirection === 'asc' ? '▲' : '▼'}
        </span>
      );
    },
    [sortField, sortDirection]
  );

  const isSorted = useCallback(
    (field: K): boolean => sortField === field,
    [sortField]
  );

  const sortValue = `${sortField}-${sortDirection}`;

  return {
    sortField,
    sortDirection,
    sortValue,
    handleSort,
    setSort,
    setSortFromValue,
    sortedData,
    getSortIndicator,
    isSorted,
  };
}

/**
 * Helper to create sort options array for BottomSheetSelect
 */
export function createSortOptions<K extends string>(
  options: Array<{ field: K; label: string; directions?: SortDirection[] }>
): SortOption[] {
  return options.flatMap(({ field, label, directions = ['asc', 'desc'] }) =>
    directions.map((dir) => ({
      value: `${field}-${dir}`,
      label: `${label} (${dir === 'asc' ? 'A-Z' : 'Z-A'})`,
    }))
  );
}
