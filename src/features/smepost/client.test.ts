import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/app-errors";
import {
  createSMEPostClient,
  isIdempotentRegisterConflict,
  smepostBaseUrl,
  smepostCloudErrorCode,
} from "./client";
import { SMEPOST_PRODUCTION_BASE_URL } from "./constants";

describe("SMEPost client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes base URLs", () => {
    expect(smepostBaseUrl("https://app.smepost.com/")).toBe("https://app.smepost.com");
  });

  it("defaults to the production SMEPost base URL when no override is provided", () => {
    expect(SMEPOST_PRODUCTION_BASE_URL).toBe("https://smepost.io");
  });

  it("starts device login with a typed response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      loginUrl: "https://example.com/login",
      pollingToken: "poll-token",
    })));

    await expect(createSMEPostClient().startDeviceLogin({ baseUrl: "https://api.example.com/" })).resolves.toEqual({
      baseUrl: "https://api.example.com",
      loginUrl: "https://example.com/login",
      pollingToken: "poll-token",
    });
  });

  it("throws an AppError for failed SMEPost responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "bad login" }, { status: 502 })));

    await expect(createSMEPostClient().startDeviceLogin({ baseUrl: "https://api.example.com" })).rejects.toMatchObject({
      code: "SMEPOST_API_FAILED",
      message: "bad login",
      status: 502,
    });
  });

  it("registers runners with pollingToken expected by SMEPost backend", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      runnerToken: "runner-token",
      runner: { runnerId: "runner-id", deviceName: "Desktop" },
      org: { id: "org-id", name: "Org", planId: "free" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await createSMEPostClient().registerRunner({
      baseUrl: "https://api.example.com",
      pollingToken: "polling-token",
      deviceName: "Desktop",
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      pollingToken: "polling-token",
      deviceName: "Desktop",
    });
  });

  it("treats already-used, missing, and not-ready device sessions as idempotent register conflicts", () => {
    expect(isIdempotentRegisterConflict(new AppError("SMEPOST_API_FAILED", {
      message: "DEVICE_SESSION_ALREADY_USED",
      details: { error: "DEVICE_SESSION_ALREADY_USED" },
    }))).toBe(true);
    expect(isIdempotentRegisterConflict(new AppError("SMEPOST_API_FAILED", {
      message: "DEVICE_SESSION_NOT_FOUND",
      details: { error: "DEVICE_SESSION_NOT_FOUND" },
    }))).toBe(true);
    expect(isIdempotentRegisterConflict(new AppError("SMEPOST_API_FAILED", {
      message: "DEVICE_SESSION_NOT_READY",
      details: { error: "DEVICE_SESSION_NOT_READY" },
    }))).toBe(true);
    expect(isIdempotentRegisterConflict(new AppError("SMEPOST_API_FAILED", {
      message: "AUTO_POST_INVALID_REQUEST",
      details: { error: "AUTO_POST_INVALID_REQUEST" },
    }))).toBe(false);
  });

  it("extracts cloud error codes from AppError details", () => {
    expect(smepostCloudErrorCode(new AppError("SMEPOST_API_FAILED", {
      message: "DEVICE_SESSION_ALREADY_USED",
      details: { error: "DEVICE_SESSION_ALREADY_USED" },
    }))).toBe("DEVICE_SESSION_ALREADY_USED");
  });
});
