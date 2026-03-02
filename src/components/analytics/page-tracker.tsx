"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/v1/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "page_view",
        event_source: "portal_ui",
        metadata: { pathname },
      }),
    }).catch(() => {
      // Ignore analytics transport failures
    });
  }, [pathname]);

  return null;
}
