"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function TemplatesRefreshButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="md"
      className="w-10 px-0"
      onClick={handleRefresh}
      disabled={refreshing}
      title="Refresh templates"
      aria-label="Refresh templates"
    >
      {refreshing ? "…" : "↻"}
    </Button>
  );
}
