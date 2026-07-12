import { describe, expect, it } from "vitest";
import { fail } from "./api";

describe("api response helpers", () => {
  it("returns stable code and message for app errors", async () => {
    const response = fail("INVALID_PAYLOAD", 400, { field: "name" });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "INVALID_PAYLOAD",
      error: "Invalid payload",
      message: "Invalid payload",
      details: { field: "name" },
    });
  });

  it("keeps legacy message callers compatible", async () => {
    const response = fail("Custom failure", 418);
    expect(response.status).toBe(418);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "UNKNOWN_ERROR",
      error: "Custom failure",
      message: "Custom failure",
    });
  });
});
