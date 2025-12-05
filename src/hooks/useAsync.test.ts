import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsync, useAsyncData } from './useAsync';

describe('useAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns initial state correctly', () => {
      const asyncFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useAsync(asyncFn));

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('uses initialData when provided', () => {
      const asyncFn = vi.fn().mockResolvedValue('new data');
      const { result } = renderHook(() =>
        useAsync(asyncFn, { initialData: 'initial' })
      );

      expect(result.current.data).toBe('initial');
    });
  });

  describe('execute', () => {
    it('sets loading to true during execution', async () => {
      const asyncFn = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('data'), 100))
        );
      const { result } = renderHook(() => useAsync(asyncFn));

      act(() => {
        result.current.execute();
      });

      expect(result.current.loading).toBe(true);
    });

    it('sets data on successful execution', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success data');
      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBe('success data');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('sets error on failed execution', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed');
    });

    it('handles non-Error rejections', async () => {
      const asyncFn = vi.fn().mockRejectedValue('string error');
      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBe('An error occurred');
    });

    it('passes arguments to async function', async () => {
      const asyncFn = vi.fn().mockResolvedValue('result');
      const { result } = renderHook(() =>
        useAsync((id: string, name: string) => asyncFn(id, name))
      );

      await act(async () => {
        await result.current.execute('123', 'test');
      });

      expect(asyncFn).toHaveBeenCalledWith('123', 'test');
    });

    it('returns data on successful execution', async () => {
      const asyncFn = vi.fn().mockResolvedValue('result');
      const { result } = renderHook(() => useAsync(asyncFn));

      let returnValue: unknown = null;
      await act(async () => {
        returnValue = await result.current.execute();
      });

      expect(returnValue).toBe('result');
    });

    it('returns null on failed execution', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const { result } = renderHook(() => useAsync(asyncFn));

      let returnValue: unknown = 'not null';
      await act(async () => {
        returnValue = await result.current.execute();
      });

      expect(returnValue).toBeNull();
    });
  });

  describe('callbacks', () => {
    it('calls onSuccess callback on successful execution', async () => {
      const onSuccess = vi.fn();
      const asyncFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useAsync(asyncFn, { onSuccess }));

      await act(async () => {
        await result.current.execute();
      });

      expect(onSuccess).toHaveBeenCalledWith('data');
    });

    it('calls onError callback on failed execution', async () => {
      const onError = vi.fn();
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const { result } = renderHook(() => useAsync(asyncFn, { onError }));

      await act(async () => {
        await result.current.execute();
      });

      expect(onError).toHaveBeenCalledWith('Failed');
    });
  });

  describe('setData', () => {
    it('manually sets data', async () => {
      const asyncFn = vi.fn().mockResolvedValue('async data');
      const { result } = renderHook(() => useAsync(asyncFn));

      act(() => {
        result.current.setData('manual data');
      });

      expect(result.current.data).toBe('manual data');
    });

    it('can set data to null', async () => {
      const asyncFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() =>
        useAsync(asyncFn, { initialData: 'initial' })
      );

      act(() => {
        result.current.setData(null);
      });

      expect(result.current.data).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets to initial state', async () => {
      const asyncFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() =>
        useAsync(asyncFn, { initialData: 'initial' })
      );

      // First execute to change state
      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBe('data');

      // Then reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBe('initial');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('resets error state', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const { result } = renderHook(() => useAsync(asyncFn));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBe('Failed');

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('clears error on new execute', () => {
    it('clears previous error when executing again', async () => {
      const asyncFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('success');
      const { result } = renderHook(() => useAsync(asyncFn));

      // First execution fails
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.error).toBe('First error');

      // Second execution succeeds
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBe('success');
    });
  });
});

describe('useAsyncData', () => {
  it('auto-executes on mount', async () => {
    const asyncFn = vi.fn().mockResolvedValue('auto data');
    renderHook(() => useAsyncData(asyncFn));

    await waitFor(() => {
      expect(asyncFn).toHaveBeenCalled();
    });
  });

  it('re-executes when dependencies change', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');

    const { rerender } = renderHook(
      ({ id }) => useAsyncData(() => asyncFn(id), [id]),
      { initialProps: { id: 1 } }
    );

    await waitFor(() => {
      expect(asyncFn).toHaveBeenCalledWith(1);
    });

    rerender({ id: 2 });

    await waitFor(() => {
      expect(asyncFn).toHaveBeenCalledWith(2);
    });
  });

  it('provides refresh function', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsyncData(asyncFn));

    await waitFor(() => {
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(asyncFn).toHaveBeenCalledTimes(2);
  });

  it('returns data after loading', async () => {
    const asyncFn = vi.fn().mockResolvedValue('loaded data');
    const { result } = renderHook(() => useAsyncData(asyncFn));

    await waitFor(() => {
      expect(result.current.data).toBe('loaded data');
    });
  });
});
