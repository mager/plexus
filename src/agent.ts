import { query, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export type AskInput = {
  model: string;
  prompt: string;
  resumeSessionId?: string;
  systemPrompt?: string;
  mcpServers?: Record<string, McpServerConfig>;
};

export type AskResult = {
  text: string;
  sessionId: string;
  usage?: { input: number; output: number };
};

export async function ask(input: AskInput): Promise<AskResult> {
  const chunks: string[] = [];
  let sessionId = input.resumeSessionId ?? "";
  let usage: AskResult["usage"];

  for await (const msg of query({
    prompt: input.prompt,
    options: {
      model: input.model,
      resume: input.resumeSessionId,
      permissionMode: "bypassPermissions",
      systemPrompt: input.systemPrompt,
      mcpServers: input.mcpServers,
    },
  })) {
    if (msg.type === "system" && msg.subtype === "init") {
      sessionId = msg.session_id;
    }
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") chunks.push(block.text);
        if (block.type === "tool_use") console.log(`  [tool] ${block.name}`);
      }
    }
    if (msg.type === "result" && "usage" in msg && msg.usage) {
      usage = {
        input: msg.usage.input_tokens ?? 0,
        output: msg.usage.output_tokens ?? 0,
      };
    }
  }

  return { text: chunks.join("").trim(), sessionId, usage };
}
