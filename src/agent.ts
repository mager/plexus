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
  costUsd?: number;
};

export async function ask(input: AskInput): Promise<AskResult> {
  const chunks: string[] = [];
  let sessionId = input.resumeSessionId ?? "";
  let usage: AskResult["usage"];
  let costUsd: number | undefined;

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
        if (block.type === "thinking") logThinking((block as { thinking?: string }).thinking);
        if (block.type === "tool_use") logTool(block.name, (block as { input?: unknown }).input);
      }
    }
    if (msg.type === "result") {
      if ("usage" in msg && msg.usage) {
        usage = {
          input: msg.usage.input_tokens ?? 0,
          output: msg.usage.output_tokens ?? 0,
        };
      }
      if ("total_cost_usd" in msg && typeof msg.total_cost_usd === "number") {
        costUsd = msg.total_cost_usd;
      }
    }
  }

  return { text: chunks.join("").trim(), sessionId, usage, costUsd };
}

const KEY_PRIORITY = [
  "file_path", "path", "pattern", "command", "url", "query", "skill",
  "description", "prompt", "title", "slug", "id", "name",
];

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const o = input as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of KEY_PRIORITY) {
    if (typeof o[k] === "string" && o[k]) {
      parts.push(`${k}=${truncate(o[k] as string, 100)}`);
      if (parts.length >= 2) break;
    }
  }
  if (parts.length === 0) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && v) {
        parts.push(`${k}=${truncate(v, 100)}`);
        break;
      }
    }
  }
  return parts.join(" ");
}

function logTool(name: string, input: unknown) {
  const detail = summarizeInput(input);
  console.log(`  [tool] ${name}${detail ? ` ${detail}` : ""}`);
}

function logThinking(text: string | undefined) {
  if (!text) return;
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return;
  console.log(`  [think] ${truncate(compact, 240)}`);
}

function truncate(s: string, n: number): string {
  s = s.replace(/\n/g, " ⏎ ");
  return s.length > n ? s.slice(0, n) + "…" : s;
}
