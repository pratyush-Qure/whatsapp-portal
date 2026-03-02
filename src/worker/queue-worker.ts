import { config as loadEnv } from "dotenv";
import { createAdminClient } from "@/lib/supabase/admin";
import { processNextJob } from "@/lib/queue/worker";

// Worker runs outside Next.js runtime, so load env files manually.
loadEnv({ path: ".env.local" });
loadEnv();

const MAX_BATCH_PER_DRAIN = 50;
const FALLBACK_POLL_MS = 5000;

let draining = false;
let reDrainRequested = false;
let shuttingDown = false;

async function drainQueue(reason: string) {
  if (shuttingDown) return;
  if (draining) {
    reDrainRequested = true;
    return;
  }
  draining = true;

  try {
    do {
      reDrainRequested = false;
      let processed = 0;
      while (processed < MAX_BATCH_PER_DRAIN && !shuttingDown) {
        const hasMore = await processNextJob();
        if (!hasMore) break;
        processed++;
      }
      if (processed >= MAX_BATCH_PER_DRAIN) {
        reDrainRequested = true;
      }
      if (processed > 0) {
        console.log(`[queue-worker] Drain reason=${reason} processed=${processed}`);
      }
    } while (reDrainRequested && !shuttingDown);
  } catch (err) {
    console.error("[queue-worker] Drain failed:", err);
  } finally {
    draining = false;
  }
}

async function start() {
  console.log("[queue-worker] Starting dedicated queue worker");
  console.log(`[queue-worker] Config: MAX_BATCH_PER_DRAIN=${MAX_BATCH_PER_DRAIN}, FALLBACK_POLL_MS=${FALLBACK_POLL_MS}`);

  const supabase = createAdminClient();
  const channel = supabase
    .channel("queue-worker-job-queue")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "job_queue" },
      () => {
        void drainQueue("realtime_insert");
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "job_queue" },
      () => {
        void drainQueue("realtime_update");
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[queue-worker] Realtime subscription active");
      }
    });

  const pollTimer = setInterval(() => {
    void drainQueue("poll");
  }, FALLBACK_POLL_MS);

  // Process any jobs that existed before worker start.
  await drainQueue("startup");

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[queue-worker] Received ${signal}, shutting down`);
    clearInterval(pollTimer);
    await supabase.removeChannel(channel);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void start();
