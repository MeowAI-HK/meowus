import type { z } from "zod";
import type { AgentExecutionContext, AgentToolDefinition } from "./contracts";

export class ToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition>();

  register<TInput extends z.ZodType, TOutput extends z.ZodType>(tool: AgentToolDefinition<TInput, TOutput>) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool as AgentToolDefinition);
    return this;
  }

  get(name: string) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool;
  }

  has(name: string) {
    return this.tools.has(name);
  }

  list() {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    }));
  }

  async execute(name: string, input: unknown, context: AgentExecutionContext) {
    const tool = this.get(name);
    const parsedInput = tool.inputSchema.parse(input);
    const output = await tool.execute(parsedInput, context);
    return tool.outputSchema.parse(output) as Record<string, unknown>;
  }

  requiresApproval(name: string, input: unknown, context: AgentExecutionContext) {
    if (context.approvedToolCallId) {
      return false;
    }
    const tool = this.get(name);
    if (!tool.requiresApproval) {
      return false;
    }
    const parsedInput = tool.inputSchema.parse(input);
    return tool.requiresApproval(parsedInput, context);
  }
}
