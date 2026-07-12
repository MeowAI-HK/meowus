import { describe, expect, it, vi } from "vitest";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

function mockFetch(response: unknown, init: ResponseInit = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(response, init)));
}

describe("api-client", () => {
  it("returns successful data", async () => {
    mockFetch({ ok: true, data: { id: "site_1" } });
    await expect(apiGet<{ id: string }>("/api/sites")).resolves.toEqual({ id: "site_1" });
  });

  it("throws API error messages", async () => {
    mockFetch({ ok: false, error: "Invalid payload" }, { status: 400 });
    await expect(apiGet("/api/sites")).rejects.toThrow("Invalid payload");
  });

  it("sends JSON bodies for mutation helpers", async () => {
    mockFetch({ ok: true, data: { saved: true } });

    await apiPost("/api/sites", { name: "Threads" });
    await apiPatch("/api/sites/1", { name: "Updated" });
    await apiDelete("/api/sites/1");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/sites",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Threads" }) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/sites/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Updated" }) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/sites/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on non-JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(apiGet("/api/sites")).rejects.toThrow("Request failed with 502");
  });
});
