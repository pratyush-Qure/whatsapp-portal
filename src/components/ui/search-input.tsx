"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 400;

type Props = {
  paramName?: string;
  placeholder?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
};

/**
 * Search input that writes to URL search param after debounce.
 * Use for server-rendered pages that read the param for DB search.
 */
export function SearchInput({
  paramName = "q",
  placeholder = "Search…",
  "aria-label": ariaLabel = "Search",
  "aria-describedby": ariaDescribedBy,
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramValue = searchParams.get(paramName) ?? "";
  const [localValue, setLocalValue] = useState(paramValue);

  useEffect(() => {
    setLocalValue(paramValue);
  }, [paramValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = new URLSearchParams(searchParams.toString());
      const trimmed = localValue.trim();
      if (trimmed) {
        current.set(paramName, trimmed);
      } else {
        current.delete(paramName);
      }
      const qs = current.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localValue, paramName, pathname, router, searchParams]);

  return (
    <Input
      type="search"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={className}
    />
  );
}
