import { NextRequest } from "next/server";
import { smepostClient, smepostBaseUrl } from "@/features/smepost/client";
import { SMEPOST_DEFAULT_DEVICE_NAME } from "@/features/smepost/constants";
import { writeSMEPostAuth } from "@/features/smepost/storage";
import { fail, failFromError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pollingToken = request.nextUrl.searchParams.get("pollingToken") || "";
  const baseUrl = smepostBaseUrl(request.nextUrl.searchParams.get("baseUrl") || undefined);
  const deviceName = request.nextUrl.searchParams.get("deviceName") || SMEPOST_DEFAULT_DEVICE_NAME;

  if (!pollingToken) {
    return fail("INVALID_PAYLOAD", 400, { field: "pollingToken" });
  }

  try {
    const pollResult = await smepostClient.pollDeviceLogin({ baseUrl, pollingToken });
    if (pollResult.status !== "completed") {
      return ok(pollResult);
    }

    const registration = await smepostClient.registerRunner({
      baseUrl,
      pollingToken,
      deviceName,
    });

    await writeSMEPostAuth({
      baseUrl,
      runnerId: registration.runner.runnerId,
      runnerToken: registration.runnerToken,
      deviceName: registration.runner.deviceName || deviceName,
      userId: registration.runner.userId,
      org: registration.org,
      connectedAt: Date.now(),
    });

    return ok({
      status: "registered",
      runner: registration.runner,
      org: registration.org,
    });
  } catch (error) {
    return failFromError(error, "SMEPOST_LOGIN_FAILED", 502);
  }
}
