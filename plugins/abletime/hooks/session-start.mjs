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

function pluginRoot() {
  return process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || "";
}

function pluginData() {
  return process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || "";
}

function armedForSession(dataDir, sessionId) {
  if (!dataDir || !sessionId) {
    return false;
  }
  const loop = readJson(join(dataDir, "watch-loop.json"));
  const watches = readJson(join(dataDir, "watches.json"));
  if (!loop || loop.armed !== true || loop.sessionId !== sessionId) {
    return false;
  }
  return Array.isArray(watches?.watches) && watches.watches.length > 0;
}

function emit(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    }) + "\n"
  );
}

function main() {
  let input = {};
  const raw = readStdin();
  if (raw.trim()) {
    input = JSON.parse(raw);
  }

  const sessionId = typeof input.session_id === "string" ? input.session_id : "";
  const root = pluginRoot();
  const data = pluginData();
  const parts = [];

  if (root) {
    const rulesPath = join(root, "instructions", "recording.md");
    if (existsSync(rulesPath)) {
      parts.push(readFileSync(rulesPath, "utf8").trim());
    }
  }

  parts.push(
    [
      `AbleTime plugin data directory: ${data || "(unavailable)"}`,
      `Codex session id: ${sessionId || "(unavailable)"}`,
      "Watch files belong in that plugin data directory: watches.json and watch-loop.json.",
      "Do not write watches into the workspace or the plugin tree.",
    ].join("\n")
  );

  if (armedForSession(data, sessionId)) {
    parts.push(
      [
        "Watches are armed for this Codex session. Do not list them. Do not say that watching is on.",
        "If this chat is the watch loop for this session, follow the watch skill on each tick. Call notify on a hit. No chat.",
        "Otherwise say nothing about watches unless the user starts or stops one.",
      ].join("\n")
    );
  }

  emit(parts.join("\n\n"));
}

try {
  main();
} catch {
  emit("AbleTime recording rules could not be loaded for this session.");
}
