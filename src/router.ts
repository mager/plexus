import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  opus: "claude-opus-4-7",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
} as const;

export type ModelKey = keyof typeof MODELS;

const CODE_HINTS =
  /\b(code|coding|function|class|bug|debug|stack ?trace|refactor|implement|typescript|python|rust|go\b|swift|kotlin|java|sql|regex|compile|npm|cargo|grep|terminal|git|commit|diff|pr\b|pull request|repo|merge|build|lint|test|unit test|integration test|deploy|api|endpoint|schema|migration|docker|kubernetes|nginx|caddy|webpack|vite|react|astro|next\.?js|node\.?js|bun|deno|file system|filesystem)\b/i;

const TRIVIAL = /^(ty|thx|thanks|ok|k|cool|nice|lol|haha|👍|✅|❤️|🙏|gm|gn|hi|hey|yo|sup)\b/i;

let anthropic: Anthropic | null = null;
const getClient = () => (anthropic ??= new Anthropic());

export async function pickModel(text: string): Promise<{
  modelKey: ModelKey;
  model: string;
  reason: string;
}> {
  if (TRIVIAL.test(text)) {
    return { modelKey: "sonnet", model: MODELS.sonnet, reason: "trivial" };
  }
  if (CODE_HINTS.test(text)) {
    return { modelKey: "opus", model: MODELS.opus, reason: "heuristic:code" };
  }

  try {
    const r = await getClient().messages.create({
      model: MODELS.haiku,
      max_tokens: 8,
      system:
        "Classify the user message into ONE token: code, research, or chat. " +
        "code = programming, debugging, architecture, technical implementation. " +
        "research = needs deep reasoning, multi-step analysis, careful synthesis. " +
        "chat = everything else. Reply with the single word only.",
      messages: [{ role: "user", content: text }],
    });
    const label =
      r.content[0]?.type === "text"
        ? r.content[0].text.trim().toLowerCase()
        : "chat";

    if (label.startsWith("code"))
      return { modelKey: "opus", model: MODELS.opus, reason: "classifier:code" };
    if (label.startsWith("research"))
      return { modelKey: "opus", model: MODELS.opus, reason: "classifier:research" };
    return { modelKey: "sonnet", model: MODELS.sonnet, reason: "classifier:chat" };
  } catch (e) {
    return { modelKey: "sonnet", model: MODELS.sonnet, reason: "classifier-error" };
  }
}
