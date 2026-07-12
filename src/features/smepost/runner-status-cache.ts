import { SMEPOST_RUNNER_STATUS_TTL_MS } from "./constants";

type CachedRunnerStatus<T> = {
  runnerId: string;
  fetchedAt: number;
  status: T;
};

let cached: CachedRunnerStatus<unknown> | null = null;
let inFlight: Promise<unknown> | null = null;
let inFlightRunnerId: string | null = null;

export function clearRunnerStatusCache() {
  cached = null;
  inFlight = null;
  inFlightRunnerId = null;
}

export async function getCachedRunnerStatus<T>(
  runnerId: string,
  fetcher: () => Promise<T>,
  ttlMs = SMEPOST_RUNNER_STATUS_TTL_MS,
): Promise<T> {
  if (cached && cached.runnerId === runnerId && Date.now() - cached.fetchedAt < ttlMs) {
    return cached.status as T;
  }

  if (inFlight && inFlightRunnerId === runnerId) {
    return inFlight as Promise<T>;
  }

  inFlightRunnerId = runnerId;
  inFlight = (async () => {
    try {
      const status = await fetcher();
      cached = {
        runnerId,
        fetchedAt: Date.now(),
        status,
      };
      return status;
    } finally {
      inFlight = null;
      inFlightRunnerId = null;
    }
  })();

  return inFlight as Promise<T>;
}
