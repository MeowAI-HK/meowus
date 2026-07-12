import { afterEach, describe, expect, it, vi } from "vitest";
import { createSMEPostClient, smepostBaseUrl } from "./client";

describe("SMEPost client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes base URLs", () => {
    expect(smepostBaseUrl("https://app.smepost.com/")).toBe("https://app.smepost.com");
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
});
