import { useEffect, useState } from 'react';

// Returns the value only after it has stopped changing for `delay` ms.
// Used to avoid firing a search request on every keystroke.
export const useDebouncedValue = <T,>(value: T, delay = 350): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};
