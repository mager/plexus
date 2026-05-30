import readline from "node:readline";
import type { Channel, IncomingMessage } from "./types.ts";

export function cli(): Channel {
  return {
    name: "cli",
    async start(handler) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "> ",
      });
      console.log("[cli] up — type to chat, ctrl-c to exit");
      rl.prompt();

      rl.on("line", async (line) => {
        const text = line.trim();
        if (!text) return rl.prompt();
        const msg: IncomingMessage = {
          channel: "cli",
          conversationId: "cli",
          userId: "local",
          text,
          reply: async (out) => {
            console.log(out);
            rl.prompt();
          },
        };
        await handler(msg);
      });
    },
  };
}
