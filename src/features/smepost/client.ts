import { AppError } from "@/lib/app-errors";
import type { SMEPostAuthState } from "./storage";
import { SMEPOST_DEFAULT_BASE_URL, SMEPOST_DEFAULT_DEVICE_NAME } from "./constants";
import { getCachedRunnerStatus } from "./runner-status-cache";

export type SMEPostDeviceStartResponse = {
  loginUrl: string;
  pollingToken: string;
  deviceCode?: string;
  expiresAt?: number;
  baseUrl: string;
};

export type SMEPostDevicePollResponse =
  | { status: "pending" | "expired"; [key: string]: unknown }
  | { status: "completed"; deviceCode?: string; org?: SMEPostAuthState["org"]; [key: string]: unknown };

export type SMEPostRunnerRegistration = {
  runner: {
    runnerId: string;
    deviceName: string;
    userId?: string;
  };
  runnerToken: string;
  org: SMEPostAuthState["org"];
};

export type SMEPostRunnerStatus = {
  org: {
    id: string;
    name: string;
    planId: string;
    imageCredit?: number;
    llmCredit?: number;
    planLimits?: {
      imageCredits: number;
      llmCredits: number;
    };
    brand?: {
      name?: string;
      description?: string;
      colors?: {
        primary?: string;
        accent?: string;
        background?: string;
      };
      logoUrl?: string;
    };
  };
  runner: { runnerId: string; deviceName: string; userId: string };
};

export interface SMEPostClient {
  startDeviceLogin(input: { baseUrl?: string; deviceName?: string }): Promise<SMEPostDeviceStartResponse>;
  pollDeviceLogin(input: { baseUrl?: string; pollingToken: string }): Promise<SMEPostDevicePollResponse>;
  registerRunner(input: { baseUrl?: string; pollingToken: string; deviceName: string }): Promise<SMEPostRunnerRegistration>;
  getRunnerStatus(auth: SMEPostAuthState): Promise<SMEPostRunnerStatus>;
  callCommand<T>(auth: SMEPostAuthState, pathName: string, init?: RequestInit): Promise<T>;
}

export function smepostBaseUrl(input?: string | null) {
  return (input || process.env.SMEPOST_API_BASE_URL || SMEPOST_DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function smepostCloudErrorCode(error: unknown): string | undefined {
  if (!(error instanceof AppError)) {
    return undefined;
  }
  const details = error.details;
  if (details && typeof details === "object" && "error" in details) {
    const code = (details as { error?: unknown }).error;
    return typeof code === "string" ? code : undefined;
  }
  if (typeof error.message === "string" && /^[A-Z][A-Z0-9_]+$/.test(error.message)) {
    return error.message;
  }
  return undefined;
}

export function isIdempotentRegisterConflict(error: unknown): boolean {
  const code = smepostCloudErrorCode(error);
  return (
    code === "DEVICE_SESSION_ALREADY_USED"
    || code === "DEVICE_SESSION_NOT_FOUND"
    || code === "DEVICE_SESSION_NOT_READY"
  );
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof json?.error === "string" ? json.error : fallbackMessage;
    throw new AppError("SMEPOST_API_FAILED", {
      status: response.status,
      message,
      details: json,
    });
  }
  return json as T;
}

export function createSMEPostClient(): SMEPostClient {
  return {
    async startDeviceLogin(input) {
      const baseUrl = smepostBaseUrl(input.baseUrl);
      const response = await fetch(`${baseUrl}/api/auto-post/device/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: input.deviceName || SMEPOST_DEFAULT_DEVICE_NAME,
        }),
      });
      return {
        ...(await readJsonResponse<Omit<SMEPostDeviceStartResponse, "baseUrl">>(
          response,
          "Failed to start SMEPost device login",
        )),
        baseUrl,
      };
    },

    async pollDeviceLogin(input) {
      const baseUrl = smepostBaseUrl(input.baseUrl);
      const response = await fetch(
        `${baseUrl}/api/auto-post/device/poll?pollingToken=${encodeURIComponent(input.pollingToken)}`,
        { cache: "no-store" },
      );
      return readJsonResponse<SMEPostDevicePollResponse>(response, "Failed to poll SMEPost login");
    },

    async registerRunner(input) {
      const baseUrl = smepostBaseUrl(input.baseUrl);
      const response = await fetch(`${baseUrl}/api/auto-post/runners/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollingToken: input.pollingToken,
          deviceName: input.deviceName,
        }),
      });
      return readJsonResponse<SMEPostRunnerRegistration>(response, "Failed to register SMEPost runner");
    },

    async getRunnerStatus(auth: SMEPostAuthState) {
      return getCachedRunnerStatus(auth.runnerId, () =>
        smepostClient.callCommand<SMEPostRunnerStatus>(
          auth,
          `/api/auto-post/runners/${encodeURIComponent(auth.runnerId)}/status`,
        ),
      );
    },

    async callCommand<T>(auth: SMEPostAuthState, pathName: string, init: RequestInit = {}) {
      const response = await fetch(`${smepostBaseUrl(auth.baseUrl)}${pathName}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.runnerToken}`,
          ...(init.headers || {}),
        },
        cache: "no-store",
      });
      return readJsonResponse<T>(response, `SMEPost API ${response.status}`);
    },
  };
}

export const smepostClient = createSMEPostClient();
