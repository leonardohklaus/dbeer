import { useState, useCallback } from 'react';

type AsyncFn<T extends unknown[], R> = (...args: T) => Promise<R>;

interface UseIPCResult<T extends unknown[], R> {
  execute: (...args: T) => Promise<R | undefined>;
  data: R | undefined;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useIPC<T extends unknown[], R>(fn: AsyncFn<T, R>): UseIPCResult<T, R> {
  const [data, setData] = useState<R | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: T): Promise<R | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn(...args);
      setData(result);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, []);

  return { execute, data, loading, error, reset };
}
