#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function pluginData() {
  return process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || "";
}

function emit(payload) {
  process.stdout.write(JSON.stringify(payload) + "\n");
}

function intervalMinutes(loop) {
  const n = Number(loop.intervalMinutes);
  if (Number.isFinite(n) && n >= 10) {
    return Math.floor(n);
  }
  return 10;
}

function main() {
  let input = {};
  const raw = readStdin();
  if (raw.trim()) {
    input = JSON.parse(raw);
  }

  const data = pluginData();
  const sessionId = typeof input.session_id === "string" ? input.session_id : "";
  if (!data || !sessionId || !existsSync(data)) {
    emit({});
    return;
  }

  const loop = readJson(join(data, "watch-loop.json"));
  const watches = readJson(join(data, "watches.json"));
  const watchRows = watches?.watches;
  if (!loop || loop.armed !== true || typeof loop.sessionId !== "string" || !loop.sessionId) {
    emit({});
    return;
  }
  if (loop.sessionId !== sessionId) {
    emit({});
    return;
  }
  if (!Array.isArray(watchRows) || watchRows.length === 0) {
    emit({});
    return;
  }

  // stop_hook_active means this turn was itself a continuation. A watch still
  // has to schedule the next tick, so that flag does not disarm the loop.
  const minutes = intervalMinutes(loop);
  const seconds = minutes * 60;
  emit({
    decision: "block",
    reason: [
      "This is an AbleTime watch tick.",
      `Wait ${minutes} minutes (\`sleep ${seconds}\`) unless a longer interval was stored in the plugin data directory's watch-loop.json.`,
      "Then run the watch skill: poll watches.json in the plugin data directory via MCP; call notify on a hit; no chat.",
      "If this chat is not the AbleTime watch loop for this session, ignore this message and do not reply.",
    ].join(" "),
  });
}

try {
  main();
} catch {
  emit({});
}
