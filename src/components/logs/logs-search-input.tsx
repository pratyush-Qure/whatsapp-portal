"use client";

import { SearchInput } from "@/components/ui/search-input";

export function LogsSearchInput() {
  return (
    <SearchInput
      paramName="q"
      placeholder="Search"
      aria-label="Search logs"
      className="max-w-sm border-[var(--border-base-default)] bg-[var(--bg-base-default)] text-[var(--text-base-default)] placeholder:text-[var(--text-base-secondary)]"
    />
  );
}
