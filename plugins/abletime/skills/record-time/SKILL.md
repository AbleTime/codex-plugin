---
name: record-time
description: Record AbleTime drafts, keep an open entry current, and create a task when the work needs one. Use when recording time, opening or updating drafts, creating a task the work belongs to, or refreshing minutes and description on an open entry.
---

# Record time

## When to use

- Recording time against a task
- Opening or updating draft calendar entries
- Creating a task the work belongs to when none fits
- Keeping an open entry's minutes (and description, when the story changed) current

## Instructions

1. Call `orientation` first. The recording rules injected at session start are in force. Load any workspace working document if present; it may tighten cadence and voice but never loosen AbleTime's recording rules.
2. Open a draft against the task the work advances. Create a task in backlog or todo when none fits. Only overhead (meetings, training) is recorded without a task.
3. Refresh minutes about every four turns, or at a natural pause — whichever comes first. If more than ten minutes have passed since the last write, update the draft now.
4. Rewrite the description only when the story of the whole span has changed; send one coalesced account, never an append about the last few minutes.
5. Close and open a new entry at midnight, a task-state change, a real gap away from the work, or a switch of focus to different work. A closed entry is never reopened.
6. Never overlap two entries on the same task. Refresh the open one, or close it and open a later one after it ends.
7. Stamp `source` as `codex` and a `sourceKey` for this segment. Address updates by calendar entry id.
8. Never accept a draft unless the person asked you to and agent acceptance is on.
9. Keep bookkeeping quiet — do not narrate recording in chat.
