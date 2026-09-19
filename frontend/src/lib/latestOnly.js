import { useCallback, useRef } from 'react';

// Filters can change faster than the server answers. Each load takes a ticket, and only the newest one may update the
// page, so a slow answer for the old filter can't land on top of the new one.
export function useLatestOnly() {
  const latest = useRef(0);
  return useCallback(() => {
    const ticket = ++latest.current;
    return () => ticket === latest.current;
  }, []);
}
