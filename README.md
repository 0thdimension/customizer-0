# Customizer 0

A control panel mod for [Claude Code](https://claude.com/claude-code). Dial in how Claude works (creativity, the questions it asks first, and how technical its explanations are) and turn on finish checks that make Claude recheck its response and point out possible issues and possible safety issues before it calls a task done.

It runs inside Claude Code: a slim bar of controls above the chat box when you want it, and a quiet status line under the chat box while it's steering Claude.

## Get it

You need Claude Code 2.1.287 or later. Nothing else: no Node.js, no server.

In a Claude Code terminal session, type:

```
/plugin install customizer-0 --marketplace 0thdimension/customizer-0
```

Answer `y` to add the marketplace, then press Enter to install it for your user. It's active right away, and in every session after.

From a shell, the same takes two steps:

```bash
claude plugin marketplace add 0thdimension/customizer-0
claude plugin install customizer-0@customizer-0
```

The Claude desktop app's Code tab doesn't take `/plugin` commands. Install from a terminal and the app's sessions load the mod too.

## Use it

Open the controls with the mod's command, which differs by app:

| Where | Command |
|---|---|
| Claude desktop app | `/customizer-0:mod` (type `/custom` and pick it from the menu) |
| Claude Code in a terminal | `/mod` |

The command on its own shows or hides the controls above the chat box. Add words to change settings directly: `/mod creativity 8`, `/mod 5 questions`, `/mod expertise vibe`, `/mod recheck on`, `/mod off`. Several work at once: `/mod creativity 8 recheck on`. `/mod status` shows your settings, `/mod preview` shows exactly what Claude is told, and `/mod help` lists every command.

The command answers at once, without a Claude turn. Changes reach Claude with your next message.

## What you can set

| Setting | What it does |
|---|---|
| **Creativity** (0–10) | From *Exact* (precisely what you asked, nothing extra) to *Unleashed* (reinterpret, invent, surprise). |
| **Questions to ask** (0–20) | How many clarifying questions Claude asks before it starts on each new request, whatever its kind. None means it states its assumptions and goes. |
| **Coding expertise** | Vibe coder, novice, intermediate, or expert. Changes how technical Claude's explanations are. |
| **Finish checks** | *Recheck response* (Claude re-reads its reply, checks the facts, and tests anything it changed), *Possible issues* (how the answer could go wrong or where you could get stuck), and *Possible safety issues*. Every reply ends with the checks you turned on. |

Each setting has an *Off* choice, and *Turn off* switches the whole mod off. Everything starts off, so installing changes nothing until you turn something on.

## How it works

- **The rules**: a conversation's first message carries the full rules for your settings, so they sit in the cached start of the conversation, and Claude Code computes that message again after a compaction or a `/clear`. After that, each prompt carries a note only Claude sees: a one-line reminder, the new rules after you change something, or a single "switched off" notice. A resumed conversation gets the rules as it resumes.
- **Finish checks**: when a reply ends without one of your checks, Claude is sent back once with the specific fix-ups, naming the files it changed that turn. It's never sent back twice in a row, and a short message that only asks you a question isn't treated as a finished reply.
- **The controls** follow your settings live, including changes made with the command or in another chat.

Your settings live in Claude Code's own store for the mod, so they survive updates.

Scripted runs (`claude -p`, Agent SDK programs) are left alone so the mod can't break output that a program parses. `/mod scripted on` includes them.

## Update or remove it

- **Update**: `claude plugin update customizer-0@customizer-0` in a terminal, or use the plugin manager (`/plugin`).
- **Remove**: `/plugin uninstall customizer-0@customizer-0`, or `claude plugin uninstall customizer-0@customizer-0` in a terminal.
## Good to know

- **The recheck reminder names only files changed with Claude's file tools** (Edit, Write, MultiEdit, NotebookEdit) in the main conversation. Files changed only by shell commands or by subagents aren't listed, though the checks still apply to the reply.
- **The checks read Claude's final message**, so the recheck line and the end sections belong there, which is where the rules ask for them.
- **Privacy**: everything stays inside Claude Code on your machine, and the mod makes no network requests. The text Claude receives comes from fixed templates in `hooks/catalog.ts` and `hooks/rules.ts`, so nothing typed into a setting reaches Claude.
- **Early access**: Claude Code's mod API can change between releases. `claude plugin validate .` and `claude plugin test .` check the mod against the version you have.

## Files

```
.claude-plugin/               the plugin and marketplace manifests
hooks/hooks.json              names the hooks module
hooks/register.tsx            the hooks module: every hook, and every call into Claude Code
hooks/catalog.ts              every label and every rule Claude receives: edit wording here
hooks/rules.ts                turns settings into those rules and the status line
hooks/settings.ts             defaults, validation, and the rules key
hooks/command.ts              what the command accepts and says
hooks/bar.tsx                 the controls bar's layout
hooks/checks.ts               the finish checks
skills/mod/SKILL.md           lists the command in the desktop app's menu; the hooks module answers it
types/index.d.ts              the settings type and the values the mod keeps for a session
tests/                        claude plugin test .
```

## Develop it

`claude --plugin-dir .` starts a terminal session with the mod loaded from this folder, and saving a file reloads it. Claude Code then lays its API types in `.claude-plugin/types/`, so `npx -p typescript tsc -p .` type-checks the mod.

## License

MIT. See [LICENSE](LICENSE).
