import { useState, useCallback } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncReturn<T, Args extends unknown[]> extends AsyncState<T> {
  execute: (...args: Args) => Promise<T | null>;
  setData: (data: T | null) => void;
  reset: () => void;
}

/**
 * Hook for handling async operations with loading, error, and data states.
 *
 * @param asyncFn - The async function to execute
 * @param options - Configuration options
 * @returns Object with data, loading, error states and execute function
 *
 * @example
 * const { data, loading, error, execute } = useAsync(
 *   (id: string) => api.fetchItem(id),
 *   { immediate: false }
 * );
 *
 * // Execute manually
 * useEffect(() => { execute(itemId); }, [itemId]);
 *
 * @example
 * // With initial data
 * const { data, loading, execute } = useAsync(
 *   () => api.fetchItems(),
 *   { initialData: [] }
 * );
 */
export function useAsync<T, Args extends unknown[] = []>(
  asyncFn: (...args: Args) => Promise<T>,
  options: {
    initialData?: T;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
): UseAsyncReturn<T, Args> {
  const { initialData = null, onSuccess, onError } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: initialData as T | null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFn(...args);
        setState({ data: result, loading: false, error: null });
        onSuccess?.(result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';
        setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
        onError?.(errorMessage);
        return null;
      }
    },
    [asyncFn, onSuccess, onError]
  );

  const setData = useCallback((data: T | null) => {
    setState((prev) => ({ ...prev, data }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: initialData as T | null,
      loading: false,
      error: null,
    });
  }, [initialData]);

  return {
    ...state,
    execute,
    setData,
    reset,
  };
}

/**
 * Simplified version that auto-executes on mount or when dependencies change.
 * Use this when you want to load data immediately.
 *
 * @example
 * const { data: items, loading, error, refresh } = useAsyncData(
 *   () => api.fetchItems(portfolioId),
 *   [portfolioId]
 * );
 */
export function useAsyncData<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: {
    initialData?: T;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
) {
  const { data, loading, error, execute, setData, reset } = useAsync(
    asyncFn,
    options
  );

  // Auto-execute when dependencies change
  // Note: This is intentionally using the deps array from the parameter
  React.useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    loading,
    error,
    refresh: execute,
    setData,
    reset,
  };
}

// Need to import React for useEffect in useAsyncData
import React from 'react';
