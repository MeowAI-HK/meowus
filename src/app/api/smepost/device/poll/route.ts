import { NextRequest } from "next/server";
import {
  isIdempotentRegisterConflict,
  smepostBaseUrl,
  smepostClient,
  smepostCloudErrorCode,
} from "@/features/smepost/client";
import { SMEPOST_DEFAULT_DEVICE_NAME } from "@/features/smepost/constants";
import { readSMEPostAuth, writeSMEPostAuth } from "@/features/smepost/storage";
import { AppError } from "@/lib/app-errors";
import { fail, failFromError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function registeredResponse(auth: NonNullable<Awaited<ReturnType<typeof readSMEPostAuth>>>) {
  return ok({
    status: "registered" as const,
    runner: {
      runnerId: auth.runnerId,
      deviceName: auth.deviceName,
      userId: auth.userId,
    },
    org: auth.org,
  });
}

function consumedSessionError(cloudCode: string, status: number, details?: unknown) {
  return new AppError("SMEPOST_LOGIN_FAILED", {
    message: cloudCode,
    status,
    details: {
      error: cloudCode,
      reconnectRequired: true,
      ...(details && typeof details === "object" ? details : {}),
    },
  });
}

export async function GET(request: NextRequest) {
  const pollingToken = request.nextUrl.searchParams.get("pollingToken") || "";
  const baseUrl = smepostBaseUrl(request.nextUrl.searchParams.get("baseUrl") || undefined);
  const deviceName = request.nextUrl.searchParams.get("deviceName") || SMEPOST_DEFAULT_DEVICE_NAME;

  if (!pollingToken) {
    return fail("INVALID_PAYLOAD", 400, { field: "pollingToken" });
  }

  try {
    const existingAuth = await readSMEPostAuth();
    if (existingAuth?.runnerToken) {
      return registeredResponse(existingAuth);
    }

    const pollResult = await smepostClient.pollDeviceLogin({ baseUrl, pollingToken });
    if (pollResult.status !== "completed") {
      return ok(pollResult);
    }

    try {
      const registration = await smepostClient.registerRunner({
        baseUrl,
        pollingToken,
        deviceName,
      });

      const auth = {
        baseUrl,
        runnerId: registration.runner.runnerId,
        runnerToken: registration.runnerToken,
        deviceName: registration.runner.deviceName || deviceName,
        userId: registration.runner.userId,
        org: registration.org,
        connectedAt: Date.now(),
      };
      await writeSMEPostAuth(auth);

      return registeredResponse(auth);
    } catch (registerError) {
      if (isIdempotentRegisterConflict(registerError)) {
        const authAfterRace = await readSMEPostAuth();
        if (authAfterRace?.runnerToken) {
          return registeredResponse(authAfterRace);
        }
        const cloudCode = smepostCloudErrorCode(registerError) || "DEVICE_SESSION_NOT_READY";
        console.error("[smepost/device/poll] register conflict without local auth", cloudCode, registerError);
        throw consumedSessionError(
          cloudCode,
          registerError instanceof AppError ? registerError.status : 400,
          registerError instanceof AppError ? registerError.details : undefined,
        );
      }
      throw registerError;
    }
  } catch (error) {
    if (isIdempotentRegisterConflict(error)) {
      const authAfterRace = await readSMEPostAuth();
      if (authAfterRace?.runnerToken) {
        return registeredResponse(authAfterRace);
      }
      const cloudCode = smepostCloudErrorCode(error) || "DEVICE_SESSION_NOT_READY";
      console.error("[smepost/device/poll] conflict without local auth", cloudCode, error);
      return failFromError(
        consumedSessionError(
          cloudCode,
          error instanceof AppError ? error.status : 400,
          error instanceof AppError ? error.details : undefined,
        ),
        "SMEPOST_LOGIN_FAILED",
        400,
      );
    }

    const cloudCode = smepostCloudErrorCode(error);
    console.error("[smepost/device/poll]", cloudCode ?? "UNKNOWN", error);
    if (cloudCode) {
      return failFromError(
        new AppError("SMEPOST_API_FAILED", {
          message: cloudCode,
          status: error instanceof AppError ? error.status : 502,
          details: error instanceof AppError ? error.details : { error: cloudCode },
        }),
        "SMEPOST_LOGIN_FAILED",
        502,
      );
    }
    return failFromError(error, "SMEPOST_LOGIN_FAILED", 502);
  }
}
