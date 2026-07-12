import { smepostClient } from "@/features/smepost/client";
import { clearSMEPostAuth, readSMEPostAuth, writeSMEPostAuth } from "@/features/smepost/storage";
import { failFromError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    return ok({
      connected: true,
      auth: {
        baseUrl: nextAuth.baseUrl,
        runnerId: nextAuth.runnerId,
        deviceName: nextAuth.deviceName,
        org: nextAuth.org,
        userId: nextAuth.userId,
        connectedAt: nextAuth.connectedAt,
      },
    });
  } catch (error) {
    await clearSMEPostAuth();
    return failFromError(error, "SMEPOST_SESSION_EXPIRED", 401);
  }
}
