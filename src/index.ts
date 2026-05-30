import "dotenv/config";
import type { Channel, IncomingMessage } from "./channels/types.ts";
import { telegram } from "./channels/telegram.ts";
import { cli } from "./channels/cli.ts";
import { ask } from "./agent.ts";
import { MODELS, type ModelKey, pickModel } from "./router.ts";
import * as state from "./state.ts";

const SYSTEM = `You are a personal assistant reached over chat channels (Telegram, CLI).
Be concise. Skip preamble. Plain text — no markdown headers, no bullet lists unless asked.
If the user wants code, give it cleanly without prose padding.`;

async function handle(msg: IncomingMessage) {
  const { conversationId, text } = msg;

  if (text.startsWith("/")) {
    const handled = await handleCommand(msg);
    if (handled) return;
  }

  const s = state.get(conversationId);
  let model: string;
  let reason: string;

  if (s.modelOverride) {
    model = s.modelOverride;
    reason = "pinned";
  } else {
    const pick = await pickModel(text);
    model = pick.model;
    reason = pick.reason;
  }

  console.log(`[${msg.channel}] ${msg.userName ?? msg.userId}: ${truncate(text, 80)} → ${shortName(model)} (${reason})`);

  await msg.typing?.();
  try {
    const res = await ask({
      model,
      prompt: text,
      resumeSessionId: s.sessionId,
      systemPrompt: SYSTEM,
    });
    state.update(conversationId, { sessionId: res.sessionId });
    await msg.reply(res.text || "(empty)");
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[agent]", err);
    await msg.reply(`error: ${err}`);
  }
}

async function handleCommand(msg: IncomingMessage): Promise<boolean> {
  const [cmd, ...rest] = msg.text.slice(1).split(/\s+/);
  const arg = rest.join(" ").trim().toLowerCase();

  switch (cmd) {
    case "model": {
      if (!arg || arg === "show") {
        const s = state.get(msg.conversationId);
        const pinned = s.modelOverride ? shortName(s.modelOverride) : "auto";
        await msg.reply(`model: ${pinned}`);
        return true;
      }
      if (arg === "auto") {
        state.update(msg.conversationId, { modelOverride: undefined });
        await msg.reply("model: auto");
        return true;
      }
      if (arg in MODELS) {
        const full = MODELS[arg as ModelKey];
        state.update(msg.conversationId, { modelOverride: full });
        await msg.reply(`model: ${arg} (pinned)`);
        return true;
      }
      await msg.reply("usage: /model opus|sonnet|haiku|auto");
      return true;
    }
    case "reset": {
      state.reset(msg.conversationId);
      await msg.reply("✓ context cleared");
      return true;
    }
    case "help": {
      await msg.reply(
        [
          "/model opus|sonnet|haiku|auto — pick model",
          "/reset — clear conversation context",
          "/help — this",
        ].join("\n"),
      );
      return true;
    }
    default:
      return false;
  }
}

function shortName(full: string): string {
  for (const [k, v] of Object.entries(MODELS)) if (v === full) return k;
  return full;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function main() {
  const names = (process.env.PLEXUS_CHANNELS ?? "telegram")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const channels: Channel[] = names.map((n) => {
    if (n === "telegram") return telegram();
    if (n === "cli") return cli();
    throw new Error(`unknown channel: ${n}`);
  });

  await Promise.all(channels.map((c) => c.start(handle)));

  const shutdown = async () => {
    console.log("\nshutting down…");
    await Promise.all(channels.map((c) => c.stop?.()));
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
