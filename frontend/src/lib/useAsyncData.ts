"use client";

import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/api';

interface Settled<T> {
  fetcher: (() => Promise<T>) | null;
  nonce: number;
  data: T | null;
  error: string;
}

export interface AsyncData<T> {
  /** Last successfully loaded value (kept while a newer request is in flight). */
  data: T | null;
  error: string;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `fetcher` whenever its identity changes (memoise it with useCallback) or
 * `reload()` is called. Pass `null` to skip, e.g. while the session is unknown.
 */
export function useAsyncData<T>(fetcher: (() => Promise<T>) | null): AsyncData<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ fetcher: null, nonce: 0, data: null, error: '' });

  useEffect(() => {
    if (!fetcher) return;
    let active = true;
    fetcher()
      .then((data) => {
        if (active) setSettled({ fetcher, nonce, data, error: '' });
      })
      .catch((err: unknown) => {
        if (active) {
          setSettled((prev) => ({
            fetcher,
            nonce,
            data: prev.data,
            error: getErrorMessage(err, 'Unable to load data. Please try again.'),
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [fetcher, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const current = settled.fetcher === fetcher && settled.nonce === nonce;
  return {
    data: settled.data,
    error: current ? settled.error : '',
    loading: fetcher === null ? true : !current,
    reload,
  };
}
