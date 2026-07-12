import { describe, expect, it } from "vitest";
import { buildLocalAgentSystemPrompt, DEFAULT_LOCAL_AGENT_SYSTEM_PROMPT, formatBrandContext } from "./system-prompt";
import { defaultBrandSettings } from "@/db/repositories/settings";

describe("local agent system prompt", () => {
  it("uses the built-in behavior when the custom prompt is empty", () => {
    const prompt = buildLocalAgentSystemPrompt({ customPrompt: "", brand: defaultBrandSettings });
    expect(prompt).toContain(DEFAULT_LOCAL_AGENT_SYSTEM_PROMPT);
    expect(prompt).toContain("Required execution protocol");
  });

  it("replaces default behavior while preserving protocol and appending non-empty brand fields", () => {
    const prompt = buildLocalAgentSystemPrompt({
      customPrompt: "Write with short, direct sentences.",
      brand: {
        ...defaultBrandSettings,
        name: "Clipversity",
        targetAudience: "Adult learners",
        colors: { ...defaultBrandSettings.colors, primary: "#123456" },
      },
    });
    expect(prompt).not.toContain(DEFAULT_LOCAL_AGENT_SYSTEM_PROMPT);
    expect(prompt).toContain("Required execution protocol");
    expect(prompt).toContain("Write with short, direct sentences.");
    expect(prompt).toContain("Brand name: Clipversity");
    expect(prompt).toContain("Target audience: Adult learners");
    expect(prompt).toContain("Primary color: #123456");
  });

  it("omits an empty brand block", () => {
    expect(formatBrandContext(defaultBrandSettings)).toBe("");
  });
});
