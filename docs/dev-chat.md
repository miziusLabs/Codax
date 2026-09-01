# DEV chat harness

The repository DEV chat exercises current source code without routing the native Codex app through
that working tree. It is intended for browser, MCP, tool-round, retry, and compaction development
while the normal launcher, its ChatGPT account, and the maintainer's active Codex session remain
usable.

## Prerequisites

- Use the repository-pinned Bun version.
- Install a launcher built from the same working tree.
- Start the isolated launcher with `bun run dev:launcher`.
- It skips the normal marketing onboarding and opens the setup surface directly. Sign in inside the
  window labelled **DEV**. This may be a different ChatGPT account.
- Run its browser smoke test and initialize the DEV profile. Complete MCP setup only when testing
  simulated tool rounds; browser, effort, context-limit, and compaction work in browser-only mode.
  The launcher stores any MCP credentials only in the DEV home and supervises only that isolated
  tunnel. Create the ChatGPT connector as `Codex Native2 DEV`; keep `Codex Native2` unchanged.

Nothing is copied from the normal launcher. The DEV command fails closed if its own launcher,
browser descriptor, credentials, or connector are not ready. It never falls back to the production
profile, another model, a fake browser, or a second connector.

## Run

One browser-only message:

```bash
bun run dev:launcher
bun run src/cli.ts dev status
bun run dev:chat smoke "Reply with exactly: DEV READY"
```

Persistent interactive chat:

```bash
bun run dev:chat compaction-lab
```

After optional Full/MCP setup, the same command also exposes simulated outer tools:

```bash
bun run dev:chat tool-lab "Use a command tool and explain the simulated receipt"
```

The direct DEV tool `mcp__dev_simulator__large_context_payload` accepts the explicit arguments
`segment` (1, 2, or 3) and `target_tokens` (1,000 to 95,000). It returns deterministic, coherent,
inert prose through the real simulated MCP-result path so a live named chat can exercise retention
and automatic compaction without embedding a giant fixture in the user prompt. It is advertised
directly rather than through deferred tool search so the test can prove the requested call happened.

Reusing the same name continues its canonical Responses history. Sequential native messages in the
same compaction epoch lease one Temporary Chat, exactly like production. Every message receives a
new turn-bound MCP token, and all MCP tool rounds for that message remain inside the same ChatGPT
response. On an exact native compaction request, the same Web agent submits the checkpoint through
a one-shot MCP control call in that chat; only then does the surface close and the next epoch open a
new Temporary Chat. The complete named history remains owned by the existing prompt compiler. New
chats use the cheapest account-supported browser mode:
Instant (`light`) when Sol is available, otherwise Luna. Override it with `--model` or `/model`.

Interactive commands:

```text
/status
/fill 30000
/send-fill 12000
/compact
/model high
/reset yes
/help
/exit
```

`/fill N` appends deterministic inert text measured by the production tokenizer. It does not open
ChatGPT. The next message checks the real model-specific auto-compaction threshold and calls the
same `compactRequest` handler when the threshold is crossed. `/compact` forces that handler
immediately. Luna keeps its production rolling-checkpoint contract and therefore rejects the
separate compact command.

`/send-fill N` sends deterministic inert text as the current message through the live browser. Use
it to exercise the one-message composer budget and multi-chunk prompt insertion independently of
history growth. The normal model-specific browser preflight still applies; crossing its measured
transport limit requests automatic compaction and retries the same DEV turn.

## Automatic browser-input compaction

Sol keeps its real 272K model context window and normal 244.8K (90%) model-level auto-compaction
threshold in Codex. The smaller ChatGPT browser input boundary is enforced separately. If the
compiled outgoing browser message crosses that boundary, the bridge returns a no-output follow-up
completion at the normal model compaction threshold; Codex then runs its existing mid-turn
compaction and retries the same user turn automatically. The bridge always sends one inline context
message; there is no Bigger Context setting or multipart staging transport. If the same user turn
still cannot fit after that one automatic compaction, it fails explicitly instead of looping.

In Full/MCP mode, compaction does not replay the expanded history into an unrelated summarizer. If
the source Web response is still waiting on a tool boundary, its canonical tool results finish that
response first. The exact retained chat then receives one strict checkpoint message with only the
one-shot MCP control capability and no ordinary work capability. The checkpoint never rides in the
tail of a potentially huge tool result, and its wait is capped at five minutes independently of the
normal turn timeout.
The old surface closes only after both the structured handoff and that Web response complete; the
next epoch then starts a fresh Temporary Chat. If the retained private chat was already closed, the
bridge starts one read-only fallback chat from the canonical Codex history instead. Browser-only mode
has no retained MCP boundary and uses the read-only compaction path. A prompt that still exceeds the
measured one-message boundary after compaction fails explicitly rather than being split.

Browser-only chats do not advertise outer tools and never claim simulated effects. Full setup keeps
the launcher-owned DEV tunnel ready so ChatGPT can create and validate `Codex Native2 DEV` before a
CLI chat starts. Each named chat attaches its broker to that tunnel, while every dispatched action
still returns an explicit simulation receipt.

The default isolated home is:

```text
~/.codex-chatgpt-web-dev/
├── config.json
├── codex-home/
├── launcher/                 # Electron userData, cookies, login, logs, window state
├── chats/<name>.json
├── runtime/
└── tunnel/
```

Set `CODEX_WEB_GPT_DEV_HOME` to choose another absolute DEV home. Generic `--home`,
`CODEX_CHATGPT_WEB_HOME`, `CODEX_HOME`, and `CODEX_WEB_GPT_LAUNCHER_DATA_DIR` never collapse the DEV
launcher into production storage.

## Isolation contract

The DEV driver:

- requires a descriptor explicitly marked `development` and a config explicitly marked
  `dev-harness`;
- uses a separate Electron `userData` directory and a separate persistent browser partition, so
  cookies, OAuth state, local storage, account selection, and launcher state cannot cross profiles;
- uses an isolated sandbox `CODEX_HOME` but never writes a Codex route into it;
- does not call setup, route connect/disconnect, service start/stop, or uninstall;
- does not start `Bun.serve` or bind the configured Responses port;
- rejects any attempt to start the Responses server from a `dev-harness` config;
- does not edit the normal `~/.codex/config.toml` or integration journal;
- leases an isolated DEV-launcher browser tab and runs the working-tree browser helper;
- owns the private DEV broker socket only for the command's lifetime;
- reuses the isolated tunnel supervised by the DEV launcher and never starts a competing alias;
- can run beside the production launcher, Responses port, and tunnel because none of their homes,
  browser partitions, descriptors, broker sockets, profiles, or aliases are shared;
- refuses to run Full-mode tool rounds until the launcher-owned DEV tunnel is ready;
- exposes ordinary structural tools, then returns a universal receipt containing
  `simulated: true` and `side_effects_performed: false` for every dispatched action.

The simulator has no keyword-to-result table and never claims that a command, patch, image read,
user interaction, or external mutation actually happened.
