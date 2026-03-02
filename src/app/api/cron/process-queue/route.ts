import { NextResponse } from "next/server";
import { processNextJob } from "@/lib/queue/worker";
import { processNextRecurring } from "@/lib/recurring/worker";
import { syncPendingTemplatesApprovalStatus } from "@/lib/templates/sync-approval-status";
import { processInboundWebhookQueue } from "@/lib/inbound/process-queue";

export const maxDuration = 60;

export async function GET(_request: Request) {
  try {
    const inboundProcessed = await processInboundWebhookQueue(50);

    let processed = 0;
    const dedicatedQueueWorker = process.env.QUEUE_WORKER_MODE === "dedicated";
    if (!dedicatedQueueWorker) {
      let hasMore = true;
      while (hasMore && processed < 10) {
        hasMore = await processNextJob();
        if (hasMore) processed++;
      }
    }
    let recurringProcessed = 0;
    let recurringMore = true;
    while (recurringMore && recurringProcessed < 5) {
      recurringMore = await processNextRecurring();
      if (recurringMore) recurringProcessed++;
    }
    const templatesSynced = await syncPendingTemplatesApprovalStatus(20);
    return NextResponse.json({
      success: true,
      inbound_processed: inboundProcessed,
      processed,
      recurring_processed: recurringProcessed,
      templates_synced: templatesSynced,
    });
  } catch (err) {
    console.error("Queue process error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
