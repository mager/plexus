import { Bot } from "grammy";
import type { Channel, IncomingMessage } from "./types.ts";

export function telegram(): Channel {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

  const allowed = new Set(
    (process.env.PLEXUS_ALLOWED_USERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const bot = new Bot(token);

  return {
    name: "telegram",
    async start(handler) {
      bot.on("message:text", async (ctx) => {
        const userId = String(ctx.from!.id);
        if (allowed.size && !allowed.has(userId)) return;

        const msg: IncomingMessage = {
          channel: "telegram",
          conversationId: String(ctx.chat.id),
          userId,
          userName: ctx.from?.username ?? ctx.from?.first_name,
          text: ctx.message.text,
          reply: async (text) => {
            for (const chunk of chunkText(text, 4000)) {
              await ctx.reply(chunk);
            }
          },
          typing: async () => {
            await ctx.replyWithChatAction("typing").catch(() => {});
          },
        };
        await handler(msg);
      });

      bot.catch((err) => console.error("[telegram]", err));
      bot.start();
      console.log("[telegram] up");
    },
    async stop() {
      await bot.stop();
    },
  };
}

function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + max));
    i += max;
  }
  return out;
}
