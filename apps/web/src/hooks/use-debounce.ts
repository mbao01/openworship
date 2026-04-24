import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a stable debounced version of the given callback.
 * The timer is cancelled automatically on unmount.
 *
 * @param fn   - Function to debounce. Always calls the latest version.
 * @param delay - Debounce delay in milliseconds.
 */
export function useDebounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
): (...args: T) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  // Keep fnRef current without adding fn to the callback's dep array.
  useEffect(() => {
    fnRef.current = fn;
  });

  // Cancel on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(
    (...args: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
}
