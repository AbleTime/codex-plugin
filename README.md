# AbleTime for Codex

Official AbleTime plugin for OpenAI Codex. Installs two MCP connectors, the customer recording rules, and the skills for time, the board, and reports.

Homepage: [https://www.abletime.com](https://www.abletime.com)

## What you get

Two remote MCP connectors on `https://track.abletime.com`:

| Connector | URL | Role |
| --- | --- | --- |
| **AbleTime** | `https://track.abletime.com/api/public/v2/mcp/full` | Time and the board |
| **AbleTime Reports** | `https://track.abletime.com/api/public/v2/mcp/reports` | Reports. Its own connection. Not on `/mcp/full`. |

Also included:

- Recording rules, injected at `SessionStart` after the hooks are trusted
- `record-time` — open a draft, keep it current, and create a task when none fits
- `walkthrough` — read the public guide at `https://docs.abletime.com/guides/1.0/agentic-ai/using-the-codex-plugin` (the page may not be published yet)
- `reports` — ask for a named report and return the share link
- `board` — epics, milestones, comments, schedule, dependency, block, and lock
- `watch` — poll for tasks assigned to you or landing in a named stage
- `intake`, `sorting-hat`, and `bugfix` — file and name the source, sort, fix and open a pull request; `notify` after each

Codex has no plugin slash-command directory. Cursor's `/watch` is the `watch` skill here: `$watch`, `/skills`, an AbleTime mention, or a plain request such as "watch tasks assigned to me".

## Reports connector

`https://track.abletime.com/api/public/v2/mcp/reports`

Codex connects and approves this server on its own, the same way as AbleTime. `/mcp/full` does not serve it.

The tool is `get_report`. It takes a date range and, optionally, which reports to draw by name or by code (`AT-001` upward). The answer is the share link: a stub, a keycode, when the link expires, and a reader path on the same host, `/r/{stub}?key={keycode}`. The page opens without signing in. The link lasts fourteen days. The numbers behind the page are not in the answer unless `includeData` is set.

An owner or admin reads the whole organization, including money. A manager reads their own projects, without money.

## Auth

Codex authenticates with **OAuth**. AbleTime answers an unauthenticated MCP call with a 401 that includes protected-resource metadata. Codex completes OAuth from that challenge.

Do **not** put a PAT or `Authorization` header in `mcp.json`. A personal access token is an AbleTime credential for other clients. It is not the Codex install path.

## Install

This repository is a Codex marketplace (`.agents/plugins/marketplace.json`) with one plugin at `plugins/abletime`.

```bash
codex plugin marketplace add AbleTime/codex-plugin
codex plugin add abletime --marketplace abletime
```

Start a new Codex session. Connect **AbleTime** and **AbleTime Reports** when Codex asks. To enable the plugin for one trusted repo, add this to that repo's `.codex/config.toml`:

```toml
[plugins."abletime@abletime"]
enabled = true
```

### Hooks

Recording rules and the watch loop are plugin hooks. Codex does not run them until you review and trust the current hook definition.

In Codex, run `/hooks`, review the AbleTime `SessionStart` and `Stop` hooks, and trust them.

### Skills

In a new session, invoke a skill with `$` (for example `$record-time` or `$watch`) or pick it from `/skills`. A request that matches a skill description can invoke it without the prefix.

### Watch

Watches are stored in the plugin data directory Codex gives the hooks (`PLUGIN_DATA`), in `watches.json` and `watch-loop.json`. They are not written into the workspace or the plugin tree.

The loop is bound to the Codex session that started it. Other sessions are not continued. The interval is at least 10 minutes. A hit calls `notify`. An empty tick stays quiet.

Stopping a watch deletes `watch-loop.json`.

## Local testing

```bash
git clone https://github.com/AbleTime/codex-plugin.git
codex plugin marketplace add ./codex-plugin
codex plugin add abletime --marketplace abletime
```

Reload the plugin list, then enable AbleTime.

## Validate

```bash
npm test
```

Runs `scripts/validate-plugin.mjs`. It checks the marketplace and plugin manifests, the logo, both live MCP URLs, the absence of credentials, skill frontmatter and connector dependencies, hook wiring, session-start context, and stop-hook continuation, including session isolation and stale or malformed watch state.

## Publication

Install from this marketplace with the commands above. Listing the plugin in the public directory shared by ChatGPT and Codex is a separate submission through the OpenAI plugin portal. This repository does not perform that submission.

## License

MIT
