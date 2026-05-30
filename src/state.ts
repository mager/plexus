import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FILE = "state.json";

export type ChatState = {
  modelOverride?: string;
  sessionId?: string;
  lastSeen?: number;
};

type Store = Record<string, ChatState>;

let cache: Store = existsSync(FILE)
  ? (JSON.parse(readFileSync(FILE, "utf8")) as Store)
  : {};

export const get = (id: string): ChatState => cache[id] ?? {};

export const update = (id: string, patch: Partial<ChatState>) => {
  cache[id] = { ...get(id), ...patch, lastSeen: Date.now() };
  writeFileSync(FILE, JSON.stringify(cache, null, 2));
};

export const reset = (id: string) => {
  delete cache[id];
  writeFileSync(FILE, JSON.stringify(cache, null, 2));
};
