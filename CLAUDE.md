# CLAUDE.md

Guidance for Claude (and other coding agents) working on plexus.

## What plexus is

A lightweight harness that wires chat channels (Telegram, CLI, iMessage, …) to
Claude with smart per-message model routing. Personal-assistant scale, not
enterprise. ~250 LoC at v0.1 and the goal is to *stay small* — small enough
that a contributor can read the whole thing in one sitting.

Design north star: **many channels in, one brain out**. The core does not
know which platform a message came from; channels are interchangeable
adapters.

## Architecture

```
channel(s) ── IncomingMessage ──► handler ──► router (picks model)
                                       │                │
                                       │                ▼
                                       └─────────► agent (Agent SDK query)
                                                        │
                                                        ▼
                                                IncomingMessage.reply()
```

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Loads channels from `PLEXUS_CHANNELS`, handles slash commands, owns the message loop |
| `src/channels/types.ts` | The `Channel` + `IncomingMessage` interfaces — the only contract a new channel must satisfy |
| `src/channels/telegram.ts` | Grammy-based Telegram adapter |
| `src/channels/cli.ts` | Local terminal channel — primary smoke test |
| `src/router.ts` | Hybrid model picker: trivial-message + code-keyword heuristics, falls back to a Haiku classifier |
| `src/agent.ts` | Thin wrapper around `query()` from `@anthropic-ai/claude-agent-sdk` — collects text + sessionId + usage |
| `src/state.ts` | Per-conversation `{ modelOverride, sessionId, lastSeen }` persisted to `state.json` |

## Dev commands

```sh
bun install                          # install deps
cp .env.example .env                 # fill in keys
bun start                            # run with PLEXUS_CHANNELS=telegram (default)
PLEXUS_CHANNELS=cli bun start        # local terminal — fastest dev loop
bun --watch src/index.ts             # hot-reload on edits
bunx tsc --noEmit                    # typecheck
```

CLI mode is the right way to smoke-test most changes — no bot setup, real
agent calls, all the routing/state code paths exercised.

## Adding a new channel

This is the most common contribution. Make it easy:

1. Create `src/channels/<name>.ts` exporting a factory: `() => Channel`.
2. Implement `start(handler)`: when a message arrives, build an
   `IncomingMessage` and call `handler(msg)`. That's it.
3. `conversationId` must be stable for a chat/thread — it's the key the
   router and state both use.
4. `reply()` should chunk long text if the platform has limits (see
   `chunkText` in `telegram.ts` for the pattern).
5. Wire it into the channel registry in `src/index.ts` (`main()` has the
   if/else — keep it boring).

Do NOT leak channel-specific concepts (chat_ids, reactions, custom emoji,
attachments) into the core `IncomingMessage` shape. If you need platform
features, extend `IncomingMessage` with *optional* fields and have the core
treat their absence as the default.

## Adding a slash command

Slash commands live in `handleCommand` in `src/index.ts`. They're handled
*before* the agent sees the message. Add a `case`, keep it short, return
`true` when you've handled it.

## Routing

Default is Sonnet 4.6. Opus 4.7 kicks in for messages classified as `code`
or `research`. Heuristics short-circuit before the classifier so trivial
messages ("ty", "ok") don't pay Haiku latency.

When tuning:

- Bias toward **cheaper**. Wrong-Sonnet costs a re-ask; wrong-Opus costs
  real money on every message.
- The classifier is `claude-haiku-4-5-20251001` with `max_tokens: 8` — keep
  it that tight.
- Users can always `/model opus` to override; trust them.

Do NOT add a fourth tier or per-channel routing rules unless there's a
clear reason. Two tiers + manual override is the whole product.

## State

`state.json` lives in the working directory. Schema:

```json
{
  "<conversationId>": {
    "modelOverride": "claude-opus-4-7",   // optional, set by /model X
    "sessionId": "abc-...",                // Agent SDK session for context resume
    "lastSeen": 1738351212000
  }
}
```

Session IDs come from the Agent SDK's `system/init` message — they let a
conversation resume context across messages without us managing transcripts.
`/reset` and `/model X` both clear sessionId on purpose so context doesn't
bleed between models.

## Conventions

- **Bun runtime, TypeScript strict.** No build step, no bundler.
- **Stay small.** New dep = justify it in the PR. We have grammy and the
  Anthropic SDKs; that's enough for v0.x.
- **Minimal abstraction.** Two channels and one router don't need
  factories, registries, or DI. Add an abstraction when the third
  implementation arrives, not before.
- **No backwards-compat shims for our own code** while we're pre-1.0. Just
  change the shape and update callers.
- **Comments are rare.** Only write one for non-obvious why. Identifier
  names carry the what.
- **Don't add a logger.** `console.log` is fine until it isn't.

## What NOT to build

- ❌ Multi-agent orchestration (one user, one assistant — that's the shape)
- ❌ Vector memory / RAG (Agent SDK sessionId resume covers it)
- ❌ Personas / characters (one system prompt is enough)
- ❌ A plugin system (channels *are* the plugin system)
- ❌ A web dashboard (CLI + logs are enough at this scale)
- ❌ Coupling to any one provider beyond Anthropic
  (router picks Anthropic models — keep it that way until there's a real
  reason to fan out)

## Testing

There are no unit tests yet, and that's intentional for v0.1 — the surface
area is small and the CLI channel is a real integration test. When tests
arrive, they go in `src/**/*.test.ts` and run with `bun test`.

Before opening a PR:

```sh
bunx tsc --noEmit
PLEXUS_CHANNELS=cli bun start    # send 3 messages: one trivial, one code, one chat
```

Confirm the log shows the right model for each (`(heuristic:code)`,
`(classifier:chat)`, etc.).

## Deploy

On macmini the bot runs under `screen` (detached). Long-term we'll move
to a launchd plist. Don't add a Dockerfile or k8s manifest — wrong scale.

## License

MIT. Keep it that way.
