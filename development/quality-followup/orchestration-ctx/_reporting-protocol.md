
## Available Tools
file read/write, bash, playwright MCP, TODO list, SendMessage, WebFetch, context7 MCP (library docs — use it for Nuxt 4 / PrimeVue 4 / Drizzle / Express 5 APIs; do not guess APIs).
**No shared TaskList in this session**: `TaskCreate/TaskUpdate/TaskList` are NOT available — skip every TaskUpdate step in your role protocol; progress-report.md is the ledger instead. Do not try ToolSearch or probe sub-agents to find them.

> **DURABILITY**: write `progress-report.md` after EACH subtask. Before approving any shutdown, write completion-report + send `COMPLETE:` first. A worker that does correct work but reports nothing is a FAILURE.

> **ADDRESSING**: send every status message to `SendMessage(to: "team-lead", ...)`. If that send is rejected as an unknown recipient, resend the identical message to `"main"` (in this harness background workers reach the lead via `main`). Never end a turn with an undelivered status message.

> **MESSAGE FORMAT**: `message` is ALWAYS a plain string `"PREFIX: ..."` plus a `summary`. Never send object-form messages except a `shutdown_response` replying to a real `shutdown_request`.

## Turning Point Rules
Non-breaking (decide, log in progress-report): equivalent libraries/patterns, internal helpers, minor refactors.
Breaking (STOP, message, WAIT): changing the API contract or DB schema others depend on, scope +30%, security issue, cannot meet acceptance criteria.
`SendMessage(to: "team-lead", message: "TURNING-POINT-BREAKING: {situation}. Options: A) ... B) .... Awaiting decision.", summary: "Breaking turning point")`

## Context Management
Use a TODO list. Write state to progress-report.md before any `/compact`; after compacting, re-read this assignment.

## Completion Report Format
`completion-report.md` sections: Deliverables (table File | Description | Status) · Key Decisions Made · Issues Encountered · Known Issues NOT Fixed (with repro) · Integration Notes · Deferred Items · How to run/verify (exact commands + observed output summary).

## Reporting Protocol (follow exactly)
1. **On start**: create `progress-report.md` with header `# Progress: {task}` and the subtask list.
2. **During work**: append `## Subtask N: {name} — ✅ Done` + findings/command output after each subtask. No other `*-report.md` files.
3. **On error**: max 2 distinct fix attempts per error. Then append `## Strategy Request` (error, attempts, ruled-out hypotheses) and send `TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request`, then WAIT.
4. **Gate messages** (when this assignment says so): send `CHECKPOINT: ...` and continue, or `WAITING: ...` and end the turn.
5. **On completion** (ALL subtasks done, tests passing): write completion-report.md, then send `COMPLETE: {task} done. Deliverables: {list}. See tasks/{dir}/completion-report.md`.
6. **On blocking issue**: `BLOCKED: {what}. Attempted: {what}. Need: {what}` then WAIT.
7. **Every turn must end with one of**: COMPLETE / BLOCKED / WAITING / CHECKPOINT (only if continuing) / TURNING-POINT-*. Never idle silently.
8. After your final COMPLETE, ignore echo/idle/notice messages that carry no new assignment — end the turn silently.
