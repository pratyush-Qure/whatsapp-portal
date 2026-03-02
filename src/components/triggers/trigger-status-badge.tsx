"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  triggerId: string;
  status: string;
  projectSlug: string;
};

function nextStatus(current: string): string {
  if (current === "active") return "paused";
  return "active";
}

export function TriggerStatusBadge({ triggerId, status, projectSlug }: Props) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  const handleClick = async () => {
    if (updating) return;
    const next = nextStatus(localStatus);
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/triggers/${triggerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? "Failed to update");
      }
      setLocalStatus(next);
      router.refresh();
    } catch {
      setUpdating(false);
    } finally {
      setUpdating(false);
    }
  };

  const variant =
    localStatus === "active" ? "success" : localStatus === "paused" ? "warning" : "neutral";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={updating}
      className={cn(
        "cursor-pointer rounded-md transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-brand-default)]",
        updating && "opacity-60"
      )}
      title={nextStatus(localStatus)}
      aria-label={`Status: ${localStatus}`}
    >
      <Badge variant={variant}>{updating ? "…" : localStatus}</Badge>
    </button>
  );
}
