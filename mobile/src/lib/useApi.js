import { useCallback, useEffect, useRef, useState } from 'react';

import { apiGet, toApiError } from './api';

/**
 * Load JSON for a screen, with the pull-to-refresh and error states every list needs.
 * Only the newest load may set state, so a slow answer for an old filter can't land on top of a newer one.
 */
export function useApi(path, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [refreshing, setRefreshing] = useState(false);
  const ticket = useRef(0);

  const run = useCallback(
    async (isRefresh) => {
      if (!enabled || !path) return;
      const mine = ++ticket.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await apiGet(path);
        if (mine === ticket.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mine === ticket.current) setError(toApiError(err));
      } finally {
        if (mine === ticket.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path, enabled],
  );

  useEffect(() => {
    run(false);
  }, [run]);

  return { data, error, loading, refreshing, reload: () => run(false), refresh: () => run(true), setData };
}
