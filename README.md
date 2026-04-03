# personal-finance

A [Claude Code](https://claude.ai/claude-code) plugin marketplace for personal finance workflows.

## Available Plugins

| Plugin | Description |
|---|---|
| [pluggy-open-finance](plugins/pluggy-open-finance/README.md) | Fetch transactions via Pluggy Open Finance, classify expenses, recognize income, and generate monthly budget reports. |

## Installing a Plugin

In any project where you use Claude Code:

```bash
# 1. Add this marketplace (one-time per project)
/plugin marketplace add icesnow10/personal-finance

# 2. Install the plugin
/plugin install pluggy-open-finance@personal-finance
```

Alternatively, add the marketplace to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "personal-finance": {
      "source": { "source": "github", "repo": "icesnow10/personal-finance" }
    }
  }
}
```

Then install via: `/plugin install pluggy-open-finance@personal-finance`

## Requirements

- [Claude Code](https://claude.ai/claude-code) CLI
- Node.js (for API calls in some plugins)
