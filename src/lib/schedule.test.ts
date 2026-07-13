import { describe, expect, it } from "vitest";
import { computeNextRunAt, isDue } from "./schedule";

describe("schedule", () => {
  it("computes the next daily run for later today", () => {
    const from = new Date(2026, 3, 22, 8, 0, 0);
    const next = computeNextRunAt([{ type: "daily", time: "09:30" }], from);
    expect(new Date(next ?? 0).getHours()).toBe(9);
    expect(new Date(next ?? 0).getMinutes()).toBe(30);
  });

  it("rolls a daily run to tomorrow after the time has passed", () => {
    const from = new Date(2026, 3, 22, 10, 0, 0);
    const next = computeNextRunAt([{ type: "daily", time: "09:30" }], from);
    expect((next ?? 0) - from.getTime()).toBeGreaterThan(20 * 60 * 60 * 1000);
  });

  it("detects due schedules", () => {
    expect(isDue(1000, 1001)).toBe(true);
    expect(isDue(1002, 1001)).toBe(false);
  });
});
