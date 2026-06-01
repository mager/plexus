import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FILE = "costs.json";

type ModelTotals = { count: number; usd: number };
type Store = {
  total: ModelTotals;
  byModel: Record<string, ModelTotals>;
  byDay: Record<string, ModelTotals>;
};

const empty = (): Store => ({ total: { count: 0, usd: 0 }, byModel: {}, byDay: {} });

let cache: Store = existsSync(FILE)
  ? (JSON.parse(readFileSync(FILE, "utf8")) as Store)
  : empty();

const today = () => new Date().toISOString().slice(0, 10);

const bump = (t: ModelTotals | undefined, usd: number): ModelTotals => ({
  count: (t?.count ?? 0) + 1,
  usd: (t?.usd ?? 0) + usd,
});

export function record(model: string, usd: number | undefined) {
  if (!usd || usd <= 0) return;
  cache.total = bump(cache.total, usd);
  cache.byModel[model] = bump(cache.byModel[model], usd);
  const d = today();
  cache.byDay[d] = bump(cache.byDay[d], usd);
  writeFileSync(FILE, JSON.stringify(cache, null, 2));
}

const fmt = (usd: number) => `$${usd.toFixed(4)}`;

export function summary(shortName: (m: string) => string): string {
  const d = today();
  const todayT = cache.byDay[d] ?? { count: 0, usd: 0 };

  const days = Object.keys(cache.byDay).sort().slice(-7);
  const week = days.reduce(
    (a, k) => ({ count: a.count + cache.byDay[k]!.count, usd: a.usd + cache.byDay[k]!.usd }),
    { count: 0, usd: 0 },
  );

  const byModel = Object.entries(cache.byModel)
    .sort(([, a], [, b]) => b.usd - a.usd)
    .map(([m, t]) => `  ${shortName(m)}: ${fmt(t.usd)} (${t.count})`)
    .join("\n");

  return [
    `today:    ${fmt(todayT.usd)} (${todayT.count} msgs)`,
    `7-day:    ${fmt(week.usd)} (${week.count} msgs)`,
    `all-time: ${fmt(cache.total.usd)} (${cache.total.count} msgs)`,
    "",
    "by model:",
    byModel || "  (none)",
  ].join("\n");
}
