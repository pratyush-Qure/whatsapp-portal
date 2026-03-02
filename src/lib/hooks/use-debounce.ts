"use client";

import { useEffect, useState } from "react";

/**
 * Returns a value that updates after `delay` ms of no changes.
 * Use for debouncing search input before hitting the API.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
