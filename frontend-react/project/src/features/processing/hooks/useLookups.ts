import { useCallback, useEffect, useRef, useState } from 'react';
import { lookupApi } from '../lookupApi';
import type { CollectorLookup, RatePolicy, WarehouseLocation } from '../types';
import { getApiErrorMessage } from '../utils/apiError';

interface LookupState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Builds a hook for one lookup. Reference data (locations, rates, collectors) barely changes,
 * so each lookup is fetched once per browser session and shared between pages; `reload()`
 * forces a fresh fetch.
 */
function createLookupHook<T>(fetcher: () => Promise<T[]>): () => LookupState<T[]> {
  const cache: { data: T[] | null; promise: Promise<T[]> | null } = { data: null, promise: null };

  return function useLookup(): LookupState<T[]> {
    const [data, setData] = useState<T[]>(cache.data ?? []);
    const [loading, setLoading] = useState(cache.data === null);
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(true);

    const load = useCallback((force: boolean) => {
      if (!force && cache.data) {
        setData(cache.data);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      if (force || !cache.promise) {
        cache.promise = fetcher()
          .then((rows) => {
            cache.data = rows;
            return rows;
          })
          .catch((e) => {
            cache.promise = null;
            throw e;
          });
      }
      cache.promise
        .then((rows) => {
          if (mounted.current) setData(rows);
        })
        .catch((e) => {
          if (mounted.current) setError(getApiErrorMessage(e, 'Failed to load reference data.'));
        })
        .finally(() => {
          if (mounted.current) setLoading(false);
        });
    }, []);

    useEffect(() => {
      mounted.current = true;
      load(false);
      return () => {
        mounted.current = false;
      };
    }, [load]);

    return { data, loading, error, reload: () => load(true) };
  };
}

export const useWarehouseLocations = createLookupHook<WarehouseLocation>(() => lookupApi.warehouseLocations());
export const useRatePolicies = createLookupHook<RatePolicy>(() => lookupApi.ratePolicies(true));
export const useCollectors = createLookupHook<CollectorLookup>(() => lookupApi.collectors());
