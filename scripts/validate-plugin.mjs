#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins", "abletime");
const errors = [];

const fullUrl = "https://track.abletime.com/api/public/v2/mcp/full";
const reportsUrl = "https://track.abletime.com/api/public/v2/mcp/reports";
const skills = [
  "record-time",
  "watch",
  "intake",
  "sorting-hat",
  "bugfix",
  "walkthrough",
  "reports",
  "board",
];

function fail(message) {
  errors.push(message);
}

function readJson(relPath) {
  const abs = join(root, relPath);
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch (err) {
    fail(`Invalid or missing JSON in ${relPath}: ${err.message}`);
    return null;
  }
}

function readText(absPath, label) {
  try {
    return readFileSync(absPath, "utf8");
  } catch (err) {
    fail(`Missing file: ${label}: ${err.message}`);
    return null;
  }
}

function linearize(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function contrastAgainstWhite(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = linearize((n >> 16) & 255);
  const g = linearize((n >> 8) & 255);
  const b = linearize(n & 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05);
}

function frontmatter(text, label) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    fail(`${label} missing YAML frontmatter`);
    return null;
  }
  return match[1];
}

function runHook(scriptName, env, stdin) {
  const childEnv = { ...process.env };
  delete childEnv.PLUGIN_ROOT;
  delete childEnv.PLUGIN_DATA;
  delete childEnv.CLAUDE_PLUGIN_ROOT;
  delete childEnv.CLAUDE_PLUGIN_DATA;
  Object.assign(childEnv, env);
  const result = spawnSync(process.execPath, [join(pluginRoot, "hooks", scriptName)], {
    input: stdin,
    encoding: "utf8",
    env: childEnv,
  });
  if (result.status !== 0) {
    fail(`${scriptName} exited ${result.status}: ${result.stderr}`);
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    fail(`${scriptName} returned invalid JSON: ${err.message}; stdout=${result.stdout}`);
    return null;
  }
}

const marketplace = readJson(".agents/plugins/marketplace.json");
if (marketplace) {
  if (marketplace.name !== "abletime") {
    fail("marketplace name must be abletime");
  }
  if (marketplace.interface?.displayName !== "AbleTime") {
    fail("marketplace interface.displayName must be AbleTime");
  }
  if (marketplace.owner && Object.prototype.hasOwnProperty.call(marketplace.owner, "email")) {
    fail("marketplace must not include owner.email");
  }
  const entry = Array.isArray(marketplace.plugins) ? marketplace.plugins[0] : null;
  if (!entry || entry.name !== "abletime") {
    fail("marketplace must list the abletime plugin");
  } else {
    if (entry.source?.source !== "local" || entry.source?.path !== "./plugins/abletime") {
      fail("marketplace source must be local ./plugins/abletime");
    }
    if (entry.policy?.installation !== "AVAILABLE" || entry.policy?.authentication !== "ON_INSTALL") {
      fail("marketplace policy must be AVAILABLE and ON_INSTALL");
    }
    if (entry.category !== "Productivity") {
      fail("marketplace category must be Productivity");
    }
  }
}

const plugin = readJson("plugins/abletime/plugin.json");
if (plugin) {
  if (plugin.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
    fail("plugin.json must declare the Agent Plugins schema");
  }
  for (const field of ["name", "version", "description", "license", "repository"]) {
    if (!plugin[field]) {
      fail(`plugin.json missing ${field}`);
    }
  }
  if (plugin.name !== "abletime" || plugin.version !== "1.0.0" || plugin.license !== "MIT") {
    fail("plugin identity must be abletime 1.0.0 MIT");
  }
  if (plugin.repository !== "https://github.com/AbleTime/codex-plugin") {
    fail("plugin repository must be the Codex plugin repo");
  }
  if (!plugin.author || plugin.author.name !== "AbleTime") {
    fail("plugin author.name must be AbleTime");
  }
  if (plugin.author && Object.prototype.hasOwnProperty.call(plugin.author, "email")) {
    fail("plugin.json must not include author.email");
  }
  const openai = plugin.extensions?.["com.openai"];
  const ui = openai?.interface;
  if (openai?.hooks !== "./hooks/hooks.json") {
    fail("OpenAI extension must point hooks at ./hooks/hooks.json");
  }
  if (!ui) {
    fail("plugin.json missing extensions.com.openai.interface");
  } else {
    if (ui.displayName !== "AbleTime" || ui.displayName.length > 30) {
      fail("displayName must be AbleTime and at most 30 characters");
    }
    if (ui.shortDescription !== "Record time and run the board" || ui.shortDescription.length > 30) {
      fail("shortDescription must be the board line and at most 30 characters");
    }
    if (!ui.longDescription || ui.longDescription.length > 4000) {
      fail("longDescription must be present and at most 4000 characters");
    }
    if (ui.developerName !== "AbleTime" || ui.category !== "Productivity") {
      fail("developerName and category must identify AbleTime Productivity");
    }
    if (!Array.isArray(ui.capabilities) || !ui.capabilities.includes("Read") || !ui.capabilities.includes("Write")) {
      fail("capabilities must include Read and Write");
    }
    if (ui.websiteURL !== "https://www.abletime.com") {
      fail("websiteURL must be https://www.abletime.com");
    }
    if (ui.privacyPolicyURL !== "https://track.abletime.com/terms/privacy") {
      fail("privacyPolicyURL must be the live privacy page");
    }
    if (ui.termsOfServiceURL !== "https://track.abletime.com/terms/toc") {
      fail("termsOfServiceURL must be the live terms page");
    }
    if (!Array.isArray(ui.defaultPrompt) || ui.defaultPrompt.length !== 2 || ui.defaultPrompt.some((item) => !item)) {
      fail("defaultPrompt must contain two non-empty prompts");
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(ui.brandColor || "") || contrastAgainstWhite(ui.brandColor) < 2) {
      fail("brandColor must be a six-digit hex color with 2:1 contrast against white");
    }
    for (const assetField of ["composerIcon", "logo"]) {
      if (ui[assetField] !== "./assets/logo.svg") {
        fail(`${assetField} must be ./assets/logo.svg`);
      }
    }
  }
}

const logo = readText(join(pluginRoot, "assets", "logo.svg"), "assets/logo.svg");
if (logo) {
  if (!logo.includes('width="512"') || !logo.includes('height="512"') || !logo.includes('viewBox="0 0 512 512"')) {
    fail("logo.svg must declare square numeric dimensions of 512");
  }
  if (logo.includes("%")) {
    fail("logo.svg dimensions must not use percentages");
  }
}

const mcp = readJson("plugins/abletime/mcp.json");
if (mcp) {
  const raw = JSON.stringify(mcp);
  if (mcp.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") {
    fail("mcp.json must declare the Agent Plugins MCP schema");
  }
  const servers = mcp.mcpServers || {};
  const names = Object.keys(servers);
  if (names.length !== 2 || !servers.AbleTime || !servers["AbleTime Reports"]) {
    fail("mcp.json must declare exactly AbleTime and AbleTime Reports");
  }
  if (servers.AbleTime?.type !== "streamable-http" || servers.AbleTime?.url !== fullUrl) {
    fail("AbleTime must be streamable-http at the live full URL");
  }
  if (servers["AbleTime Reports"]?.type !== "streamable-http" || servers["AbleTime Reports"]?.url !== reportsUrl) {
    fail("AbleTime Reports must be streamable-http at the live reports URL");
  }
  if (/Authorization/i.test(raw) || /Bearer/i.test(raw) || /\bPAT\b/i.test(raw) || raw.includes("${")) {
    fail("mcp.json must not contain credentials or variable substitution");
  }
  if (raw.includes("headers")) {
    fail("mcp.json must not declare headers");
  }
}

const recording = readText(join(pluginRoot, "instructions", "recording.md"), "instructions/recording.md");
if (recording) {
  for (const phrase of [
    "Work belongs to a task",
    "Never overlap entries on the same task",
    "Bookkeeping stays quiet",
  ]) {
    if (!recording.includes(phrase)) {
      fail(`recording rules missing: ${phrase}`);
    }
  }
}

for (const skill of skills) {
  const skillPath = join(pluginRoot, "skills", skill, "SKILL.md");
  const text = readText(skillPath, `skills/${skill}/SKILL.md`);
  if (!text) {
    continue;
  }
  const fm = frontmatter(text, `skills/${skill}/SKILL.md`);
  if (fm) {
    if (!new RegExp(`^name\\s*:\\s*${skill}\\s*$`, "m").test(fm)) {
      fail(`skills/${skill}/SKILL.md frontmatter name must be ${skill}`);
    }
    if (!/^description\s*:/m.test(fm)) {
      fail(`skills/${skill}/SKILL.md frontmatter missing description`);
    }
  }
  const yaml = readText(join(pluginRoot, "skills", skill, "agents", "openai.yaml"), `skills/${skill}/agents/openai.yaml`);
  if (!yaml) {
    continue;
  }
  if (!yaml.includes('brand_color: "#D84315"') || !yaml.includes("display_name:")) {
    fail(`skills/${skill} OpenAI metadata missing display name or brand color`);
  }
  if (skill === "walkthrough") {
    if (yaml.includes('type: "mcp"')) {
      fail("walkthrough must not declare an MCP dependency");
    }
    if (!text.includes("https://docs.abletime.com/guides/1.0/agentic-ai/using-the-codex-plugin")) {
      fail("walkthrough must fetch the Codex guide");
    }
  } else if (!yaml.includes('type: "mcp"') || !yaml.includes('transport: "streamable_http"') || !yaml.includes(`url: "${fullUrl}"`)) {
    fail(`skills/${skill} must depend on the AbleTime connector`);
  }
  if (skill === "reports" && !yaml.includes(`url: "${reportsUrl}"`)) {
    fail("reports must also depend on the AbleTime Reports connector");
  }
}

const watchSkill = readText(join(pluginRoot, "skills", "watch", "SKILL.md"), "watch skill");
if (watchSkill) {
  for (const phrase of ["$watch", "sessionId", "plugin data directory", "sleep 600"]) {
    if (!watchSkill.includes(phrase)) {
      fail(`watch skill missing ${phrase}`);
    }
  }
  if (!watchSkill.includes("no `/watch` command")) {
    fail("watch skill must document that Codex has no /watch command");
  }
  if (watchSkill.includes(".cursor")) {
    fail("watch skill must not use a Cursor path");
  }
}

if (existsSync(join(pluginRoot, "commands"))) {
  fail("Codex plugin must not ship a commands directory");
}

const hooks = readJson("plugins/abletime/hooks/hooks.json");
if (hooks) {
  const events = Object.keys(hooks.hooks || {});
  if (events.length !== 2 || !hooks.hooks.SessionStart || !hooks.hooks.Stop) {
    fail("hooks.json must declare SessionStart and Stop");
  }
  const start = hooks.hooks?.SessionStart?.[0]?.hooks?.[0];
  const stop = hooks.hooks?.Stop?.[0]?.hooks?.[0];
  if (start?.type !== "command" || start.command !== "node ${PLUGIN_ROOT}/hooks/session-start.mjs") {
    fail("SessionStart must run the session-start script through PLUGIN_ROOT");
  }
  if (stop?.type !== "command" || stop.command !== "node ${PLUGIN_ROOT}/hooks/stop.mjs") {
    fail("Stop must run the stop script through PLUGIN_ROOT");
  }
}

function writeState(dir, watches, loop) {
  if (watches !== undefined) {
    writeFileSync(join(dir, "watches.json"), typeof watches === "string" ? watches : JSON.stringify(watches));
  }
  if (loop !== undefined) {
    writeFileSync(join(dir, "watch-loop.json"), typeof loop === "string" ? loop : JSON.stringify(loop));
  }
}

const dataDir = mkdtempSync(join(tmpdir(), "abletime-codex-"));
try {
  const baseEnv = { PLUGIN_ROOT: pluginRoot, PLUGIN_DATA: dataDir };
  const idle = runHook("session-start.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (idle) {
    const context = idle.hookSpecificOutput?.additionalContext || "";
    if (idle.hookSpecificOutput?.hookEventName !== "SessionStart") {
      fail("SessionStart output must name the SessionStart event");
    }
    for (const phrase of ["Work belongs to a task", "Codex session id: session-a", `AbleTime plugin data directory: ${dataDir}`]) {
      if (!context.includes(phrase)) {
        fail(`SessionStart context missing: ${phrase}`);
      }
    }
    if (context.includes("Watches are armed")) {
      fail("SessionStart must not announce watches when none are armed");
    }
  }

  writeState(
    dataDir,
    { watches: [{ kind: "assigned", assignedUserId: "user-1" }] },
    { armed: true, sessionId: "session-a", intervalMinutes: 10 }
  );
  const armed = runHook("session-start.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  const armedContext = armed?.hookSpecificOutput?.additionalContext || "";
  if (!armedContext.includes("Watches are armed for this Codex session") || !armedContext.includes("Do not list them")) {
    fail("SessionStart must inject quiet watch context for the armed session");
  }

  const other = runHook("session-start.mjs", baseEnv, JSON.stringify({ session_id: "session-b" }));
  if ((other?.hookSpecificOutput?.additionalContext || "").includes("Watches are armed")) {
    fail("SessionStart must not arm a different Codex session");
  }

  writeState(dataDir, "{", { armed: true, sessionId: "session-a" });
  const malformedStart = runHook("session-start.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if ((malformedStart?.hookSpecificOutput?.additionalContext || "").includes("Watches are armed")) {
    fail("SessionStart must ignore malformed watch state");
  }

  const brokenStdin = runHook("session-start.mjs", baseEnv, "{");
  if (brokenStdin?.hookSpecificOutput?.hookEventName !== "SessionStart") {
    fail("SessionStart must still return JSON when stdin is malformed");
  }

  rmSync(join(dataDir, "watches.json"), { force: true });
  rmSync(join(dataDir, "watch-loop.json"), { force: true });
  const idleStop = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (!idleStop || idleStop.decision) {
    fail("Stop must not continue when no watch loop is armed");
  }

  writeState(
    dataDir,
    { watches: [{ kind: "assigned" }] },
    { armed: true, sessionId: "session-a", intervalMinutes: 10 }
  );
  const continued = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a", stop_hook_active: false }));
  if (continued?.decision !== "block" || !continued.reason?.includes("sleep 600")) {
    fail("Stop must continue the armed session after 600 seconds");
  }

  const alreadyContinued = runHook(
    "stop.mjs",
    baseEnv,
    JSON.stringify({ session_id: "session-a", stop_hook_active: true })
  );
  if (alreadyContinued?.decision !== "block") {
    fail("Stop must keep the watch loop alive after a continuation tick");
  }

  writeState(dataDir, { watches: [{ kind: "assigned" }] }, { armed: true, sessionId: "session-a", intervalMinutes: 15 });
  const longer = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (!longer?.reason?.includes("sleep 900")) {
    fail("Stop must honor an interval above the 10-minute floor");
  }

  writeState(dataDir, { watches: [{ kind: "assigned" }] }, { armed: true, sessionId: "session-a", intervalMinutes: 3 });
  const floored = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (!floored?.reason?.includes("sleep 600")) {
    fail("Stop must raise a short interval to the 10-minute floor");
  }

  const isolated = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-b" }));
  if (!isolated || isolated.decision) {
    fail("Stop must not continue a session that did not arm the watch");
  }

  writeState(dataDir, "{", { armed: true, sessionId: "session-a" });
  const badWatches = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (!badWatches || badWatches.decision) {
    fail("Stop must not continue malformed watch state");
  }

  writeState(dataDir, { watches: [{ kind: "assigned" }] }, "{");
  const badLoop = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (!badLoop || badLoop.decision) {
    fail("Stop must not continue a malformed loop file");
  }

  writeState(dataDir, { watches: [] }, { armed: true, sessionId: "session-a" });
  const stale = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (!stale || stale.decision) {
    fail("Stop must not continue a loop whose watch list is empty");
  }

  writeState(dataDir, { watches: [{ kind: "assigned" }] }, { armed: true });
  const unbound = runHook("stop.mjs", baseEnv, JSON.stringify({ session_id: "session-a" }));
  if (!unbound || unbound.decision) {
    fail("Stop must not continue a loop that is not bound to a session");
  }

  const noData = runHook("stop.mjs", { PLUGIN_ROOT: pluginRoot }, JSON.stringify({ session_id: "session-a" }));
  if (!noData || noData.decision) {
    fail("Stop must not continue without a plugin data directory");
  }

  const badStopStdin = runHook("stop.mjs", baseEnv, "{");
  if (!badStopStdin || badStopStdin.decision) {
    fail("Stop must return an empty JSON object when stdin is malformed");
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

if (errors.length) {
  console.error("validate-plugin failed:\n" + errors.map((error) => ` - ${error}`).join("\n"));
  process.exit(1);
}

console.log("validate-plugin: ok");
