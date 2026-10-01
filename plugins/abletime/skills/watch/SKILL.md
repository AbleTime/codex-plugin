---
name: watch
description: Poll via MCP for tasks assigned to me or landing in a named stage, and notify on a hit. Use for watch, notify, assigned to me, stage landing, $watch, or "let me know when a task lands in a stage."
---

# Watch

Poll on a timer for assigned tasks or stage landings. A hit calls `notify`. Chat is not the notify. Do not record time on watch ticks — use the record-time skill for that.

Codex has no `/watch` command. Start this skill with `$watch`, `/skills`, an AbleTime plugin mention, or natural language.

## Quiet

Background work. No chat on start, ticks, or hits. Do not narrate orientation, id resolution, file writes, what is being watched, or that watching has begun.

- **Start:** arm the loop, run the first check, `notify` if that check hits. No chat.
- **Ticks:** `notify` when something new matches. Empty tick: no chat, no notify.
- **Stop:** delete the loop file. One short line that watching stopped. Nothing else.

## Start and stop

- **Start:** `$watch` or natural language ("watch tasks assigned to me", "notify when something lands in Marketing").
- **Stop:** `$watch stop` or "stop watching" — delete `watch-loop.json` in the plugin data directory and do not re-arm.

The plugin data directory and the Codex session id arrive in the session context. Persist watches there, never in the workspace and never in the plugin tree:

- `watches.json`
- `watch-loop.json`

If the session context does not name the plugin data directory or the session id, ask once and wait. Do not guess a path.

Starting a watch writes `watch-loop.json`:

```json
{
  "armed": true,
  "sessionId": "<Codex session id from the session context>",
  "intervalMinutes": 10
}
```

Add `"intervalMinutes"` above 10 only when the user asked for a longer interval. One watch loop at a time. Starting a new loop replaces `watch-loop.json` and keeps the watch list in `watches.json`. The Stop hook continues only the Codex session named by `sessionId`.

Do not schedule any other timer. Do not invent watch kinds beyond what this skill defines.

## Watch file

`watches.json`:

```json
{
  "watches": [
    {
      "kind": "assigned",
      "assignedUserId": "<from orientation>",
      "lastSeen": "<ISO8601 or empty>"
    },
    {
      "kind": "stage",
      "projectId": "<id>",
      "projectName": "<name>",
      "stageId": "<id>",
      "stageName": "Marketing",
      "lastSeen": "<ISO8601 or empty>"
    }
  ]
}
```

Resolve "me" and stage names through MCP before saving ids. Merge new watches into the existing list; do not drop unrelated watches unless the user asks to remove them.

## Timer watches (poll on interval)

Only these two kinds run on the timer:

1. **Assigned to me** — call `orientation` for `userId`, then `list_tasks` with `assignedUserId`. Use `updatedSince` from the watch's `lastSeen` when set.
2. **Stage landing** — call `get_project` (expand stages) to resolve the stage name to `stageId`, then `list_tasks` with `stageId` and `projectId`. Use `updatedSince` from `lastSeen` when set.

After a check that finds matches, update each affected watch's `lastSeen` to the newest matching task's update time (or now if none returned a timestamp).

## Hit

For each new matching task, call `notify` with `title` (required), `body` (what matched), and `timeflowTaskId` of that task. One call per task. Do not also write it in chat.

## One-shot (no timer)

Comments, unblocked tasks, feeds, and workload questions are answered once on demand — do not add them to the watch file or start a loop.

## Polling cadence

Default interval: **10 minutes**. Never poll faster than 10 minutes. Use a longer interval only when the user asks; store it in `watch-loop.json` as `"intervalMinutes": N`.

Each tick:

1. Run the checks for every watch in the file.
2. If something new matches, `notify` for each matching task. Empty tick: **no chat, no notify**.
3. Wait with `sleep 600` (or agreed minutes × 60), then end the turn so the plugin Stop hook can send the next tick.

When the Stop hook delivers a continuation saying this is a watch tick, run this skill. If this chat is not the watch loop for this session, ignore the continuation and do not reply.

## MCP tools

Use `orientation`, `list_tasks`, `get_project`, `notify`. Read `tool_schema` when argument shapes are unclear.
