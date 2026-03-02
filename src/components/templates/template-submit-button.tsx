"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  templateId: string;
};

export function TemplateSubmitButton({ templateId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/templates/${templateId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? "Submit failed");
      }
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submit failed";
      window.alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-24 justify-center"
      onClick={handleSubmit}
      disabled={submitting}
    >
      {submitting ? "Submitting..." : "Submit"}
    </Button>
  );
}
