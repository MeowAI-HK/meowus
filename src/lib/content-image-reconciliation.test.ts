import { describe, expect, it } from "vitest";
import { deriveContentImageAssociations } from "./content-image-reconciliation";

describe("content image reconciliation", () => {
  it("associates a completed image with the latest preceding draft in the same thread", () => {
    expect(deriveContentImageAssociations([
      {
        threadId: "thread-1",
        name: "generate_social_post_draft",
        status: "completed",
        output: { itemId: "content-1" },
      },
      {
        threadId: "thread-1",
        name: "generate_image_prompt",
        status: "completed",
        output: { prompt: "A sunny orange cat" },
      },
      {
        threadId: "thread-1",
        name: "generate_image_file",
        status: "completed",
        output: { path: "C:/artifacts/cat.jpg", provider: "gemini", model: "image-model" },
      },
    ])).toEqual([{
      itemId: "content-1",
      imagePath: "C:/artifacts/cat.jpg",
      imagePrompt: "A sunny orange cat",
      provider: "gemini",
      model: "image-model",
    }]);
  });

  it("does not cross-associate unrelated threads or failed tools", () => {
    expect(deriveContentImageAssociations([
      {
        threadId: "thread-1",
        name: "generate_social_post_draft",
        status: "completed",
        output: { itemId: "content-1" },
      },
      {
        threadId: "thread-2",
        name: "generate_image_file",
        status: "completed",
        output: { path: "C:/artifacts/unrelated.jpg" },
      },
      {
        threadId: "thread-1",
        name: "generate_image_file",
        status: "failed",
        output: { path: "C:/artifacts/failed.jpg" },
      },
    ])).toEqual([]);
  });
});
