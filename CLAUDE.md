# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **Claude Code plugin marketplace** for personal finance. It hosts installable plugins; it is not an application and has no build, lint, or test commands. The only content is JSON manifests and SKILL.md files.

## Architecture

### Two-level structure

```
.claude-plugin/marketplace.json        ← repo-level registry (Claude Code reads this)
plugins/<plugin-name>/
  .claude-plugin/plugin.json           ← per-plugin manifest
  skills/<skill-name>/SKILL.md         ← Claude Code skill definition
  README.md                            ← human-facing docs
```

### How Claude Code discovers this marketplace

Claude Code reads `.claude-plugin/marketplace.json` at the repo root. The `source` field in each plugin entry points to the plugin's directory (e.g. `"./plugins/open-personal-finance"`). Claude Code then reads that directory's `.claude-plugin/plugin.json` to find the skills.

### How skills are structured

Each `skills/<name>/SKILL.md` has YAML frontmatter with `name` and `description`, followed by Markdown instructions. The `description` is what Claude Code uses to decide when to invoke the skill — it must be precise and include trigger phrases.

### The `open-personal-finance` plugin skill pipeline

The 6 skills form a pipeline orchestrated by `/compile`:

```
/compile
  └── /fetch          → pulls transactions from Pluggy API → transactions_raw.json
  └── /recognize      → classifies income from savings account movements
  └── /categorize     → maps expenses to categories using expenses_memory.md
  └── /forecast       (partial months only)
        └── /recognize  → provisions expected salary not yet arrived
        └── /provision  → estimates recurring expenses not yet charged
```

Skills read from and write to `resources/` in the **consuming project** (not this repo). The two persistent reference files that grow over time are `resources/expenses_memory.md` (merchant→category mappings) and `resources/income_inputs.md` (salary rules).

## Adding a new plugin

1. Create `plugins/<plugin-name>/` with:
   - `.claude-plugin/plugin.json` — `{ "name", "version", "description" }`
   - `skills/<skill-name>/SKILL.md` — frontmatter + instructions
   - `README.md` — human docs
2. Register in `.claude-plugin/marketplace.json` — add an entry to `plugins[]` with `name`, `description`, `source`, `category`, `version`

The `name` in `plugin.json`, the directory name under `plugins/`, and the `name` in `marketplace.json` must all match.

## Editing a skill

SKILL.md files are instruction documents for Claude, not code. When editing:
- The `description` frontmatter field drives invocation — keep it specific with trigger phrases
- Reference files (e.g. `resources/expenses_memory.md`) are in the **consuming project**, not here
- `node -e` is used for HTTP calls (cross-platform); `curl` is a fallback

## Installing this marketplace in another project

```bash
/plugin marketplace add icesnow10/personal-finance
/plugin install open-personal-finance@personal-finance
```
