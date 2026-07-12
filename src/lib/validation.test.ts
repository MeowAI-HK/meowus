import { describe, expect, it } from "vitest";
import { importUrlSchema, runInputSchema } from "./validation";

describe("validation", () => {
  it("rejects non-http URL imports", () => {
    expect(importUrlSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });

  it("accepts a Threads run payload", () => {
    const parsed = runInputSchema.parse({
      playbookId: "threads_auto_post",
      siteId: "site_1",
      params: { contentFolder: "C:/tmp/posts", confirmLivePost: false },
    });
    expect(parsed.playbookId).toBe("threads_auto_post");
  });
});
