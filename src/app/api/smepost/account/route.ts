import { smepostClient, smepostCloudErrorCode } from "@/features/smepost/client";
import { clearSMEPostAuth, readSMEPostAuth, writeSMEPostAuth } from "@/features/smepost/storage";
import { AppError } from "@/lib/app-errors";
import { failFromError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUnauthorizedCloudError(error: unknown): boolean {
  if (error instanceof AppError && error.status === 401) {
    return true;
  }
  const code = smepostCloudErrorCode(error);
  return code === "AUTO_POST_UNAUTHORIZED" || code === "SMEPOST_SESSION_EXPIRED";
}

function cachedAuthPayload(auth: NonNullable<Awaited<ReturnType<typeof readSMEPostAuth>>>, warning?: string) {
  return {
    connected: true as const,
    warning,
    auth: {
      baseUrl: auth.baseUrl,
      runnerId: auth.runnerId,
      deviceName: auth.deviceName,
      org: auth.org,
      userId: auth.userId,
      connectedAt: auth.connectedAt,
    },
  };
}

export async function GET() {
  const auth = await readSMEPostAuth();
  if (!auth) {
    return ok({ connected: false });
  }

  try {
    const status = await smepostClient.getRunnerStatus(auth);

    const nextAuth = {
      ...auth,
      org: {
        ...auth.org,
        ...status.org,
      },
      deviceName: status.runner.deviceName || auth.deviceName,
      userId: status.runner.userId || auth.userId,
    };
    await writeSMEPostAuth(nextAuth);

    return ok(cachedAuthPayload(nextAuth));
  } catch (error) {
    console.error("[smepost/account] runner status failed", smepostCloudErrorCode(error) ?? error, error);

    if (isUnauthorizedCloudError(error)) {
      await clearSMEPostAuth();
      return failFromError(error, "SMEPOST_SESSION_EXPIRED", 401);
    }

    // Keep local auth when cloud status is temporarily broken (e.g. AUTO_POST_FAILED).
    // Clearing would permanently lose the one-time runnerToken.
    const warning = smepostCloudErrorCode(error) || (error instanceof Error ? error.message : "STATUS_UNAVAILABLE");
    return ok(cachedAuthPayload(auth, warning));
  }
}
