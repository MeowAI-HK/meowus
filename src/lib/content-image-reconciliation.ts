export type CompletedToolRecord = {
  threadId: string;
  name: string;
  status: string;
  output: Record<string, unknown>;
};

export type ContentImageAssociation = {
  itemId: string;
  imagePath: string;
  imagePrompt?: string;
  provider?: string;
  model?: string;
};

export function deriveContentImageAssociations(tools: CompletedToolRecord[]) {
  const stateByThread = new Map<string, { itemId?: string; imagePrompt?: string }>();
  const associations: ContentImageAssociation[] = [];

  for (const tool of tools) {
    if (tool.status !== "completed") continue;
    const state = stateByThread.get(tool.threadId) ?? {};
    if (tool.name === "generate_social_post_draft" && typeof tool.output.itemId === "string") {
      state.itemId = tool.output.itemId;
      state.imagePrompt = undefined;
    } else if (tool.name === "generate_image_prompt" && typeof tool.output.prompt === "string") {
      state.imagePrompt = tool.output.prompt;
    } else if (
      tool.name === "generate_image_file"
      && state.itemId
      && typeof tool.output.path === "string"
      && tool.output.path.trim()
    ) {
      associations.push({
        itemId: state.itemId,
        imagePath: tool.output.path,
        imagePrompt: state.imagePrompt,
        provider: typeof tool.output.provider === "string" ? tool.output.provider : undefined,
        model: typeof tool.output.model === "string" ? tool.output.model : undefined,
      });
    }
    stateByThread.set(tool.threadId, state);
  }

  return associations;
}
