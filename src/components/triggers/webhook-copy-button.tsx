"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = { url: string; label?: string };

export function WebhookCopyButton({ url, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 font-mono text-xs"
      onClick={handleCopy}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
