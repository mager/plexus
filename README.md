# plexus

A lightweight harness wiring chat channels (Telegram, CLI, more) to Claude with smart model routing.

Many channels in. One brain out. A plexus.

## Status

v0.1 — early. Telegram and CLI channels work. Router picks Sonnet by default and Opus for coding tasks.

## Quick start

```sh
bun install
cp .env.example .env   # fill in keys
bun start
```

Set `PLEXUS_CHANNELS=cli` to chat locally without Telegram.

## Architecture

```
channel(s) ── IncomingMessage ──► router ──► agent (Claude Agent SDK) ──► reply
                                    │
                                    └─ picks model per message
```

- `src/channels/` — adapters implementing the `Channel` interface
- `src/router.ts` — hybrid: heuristic short-circuit + Haiku classifier fallback
- `src/agent.ts` — wraps the Claude Agent SDK `query()` loop
- `src/state.ts` — per-conversation model override and session resume

## Slash commands

- `/model opus|sonnet|haiku` — pin a model for this conversation
- `/model auto` — let the router decide (default)
- `/reset` — drop conversation context
- `/cost` — show recent usage

## License

MIT.
