import { claimNextQueuedRun } from "@/db/repository";
import { processRun } from "./runner";
import { schedulerTick } from "./scheduler-service";

const pollMs = Number(process.env.SOCIAL_AUTO_POST_WORKER_POLL_MS ?? 10_000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick() {
  const scheduled = await schedulerTick();
  if (scheduled.processed) return true;
  const run = await claimNextQueuedRun();
  if (run) {
    await processRun(run);
    return true;
  }
  return false;
}

async function main() {
  console.log(`[worker] Meowus worker started. Poll=${pollMs}ms`);
  while (true) {
    try {
      const hadWork = await tick();
      if (!hadWork) {
        await sleep(pollMs);
      }
    } catch (error) {
      console.error("[worker] tick failed", error);
      await sleep(pollMs);
    }
  }
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
