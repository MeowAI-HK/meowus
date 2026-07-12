import { describe, expect, it } from "vitest";
import { isMissedOneTimeSchedule, missedOneTimeGraceMs } from "./scheduler-service";

describe("scheduled run recovery", () => {
  it("marks a one-time schedule missed only after the grace period", () => {
    expect(isMissedOneTimeSchedule({ dueAt: 1_000, now: 1_000 + missedOneTimeGraceMs, isOnce: true })).toBe(false);
    expect(isMissedOneTimeSchedule({ dueAt: 1_000, now: 1_001 + missedOneTimeGraceMs, isOnce: true })).toBe(true);
  });

  it("does not mark recurring schedules missed", () => {
    expect(isMissedOneTimeSchedule({ dueAt: 1_000, now: 1_000_000, isOnce: false })).toBe(false);
  });
});
