import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchMessage } from "@/lib/engine/dispatcher";

type InboundRow = {
  id: string;
  project_slug: string;
  trigger_slug: string;
  kind: string;
  payload: unknown;
  idempotency_key: string | null;
};

/**
 * Process pending inbound webhook queue: idempotency is applied inside dispatchMessage.
 * Call from cron after processing job_queue.
 */
export async function processInboundWebhookQueue(maxCount = 50): Promise<number> {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("inbound_webhook_queue")
    .select("id, project_slug, trigger_slug, kind, payload, idempotency_key")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(maxCount);

  if (!rows?.length) return 0;

  let processed = 0;
  for (const row of rows as InboundRow[]) {
    await supabase
      .from("inbound_webhook_queue")
      .update({ status: "processing" })
      .eq("id", row.id);

    try {
      if (row.kind === "single") {
        const payload = (row.payload || {}) as Record<string, unknown>;
        const idempotencyKey = row.idempotency_key ?? undefined;
        await dispatchMessage(
          row.trigger_slug,
          payload,
          idempotencyKey,
          undefined,
          row.project_slug
        );
      } else if (row.kind === "batch") {
        const payloads = (row.payload as { payloads?: Record<string, unknown>[] })?.payloads;
        if (Array.isArray(payloads)) {
          for (const payload of payloads) {
            const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
            const idempotencyKey = typeof p?.idempotency_key === "string" ? p.idempotency_key : undefined;
            try {
              await dispatchMessage(
                row.trigger_slug,
                p,
                idempotencyKey,
                undefined,
                row.project_slug
              );
            } catch {
              // Continue with next payload in batch
            }
          }
        }
      }

      await supabase
        .from("inbound_webhook_queue")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", row.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from("inbound_webhook_queue")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          error_message: message.slice(0, 1000),
        })
        .eq("id", row.id);
    }
  }
  return processed;
}
