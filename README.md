# AgentLint

**Audit any website for AI-agent friendliness.** One command tells you if your site is ready for LLMs, crawlers, and autonomous agents — or what's blocking them.

```bash
npx @cjavdev/agent-lint https://docs.example.com
```

```
AgentLint Report: https://docs.example.com/
────────────────────────────────────────────────────────────

  ✖ No /llms.txt file found                          [discoverability/llms-txt]
  ✖ No markdown representation available              [transport/accept-markdown]
  ⚠ Sitemap not found at /sitemap.xml                 [discoverability/sitemap]
  ⚠ Headings missing anchor IDs (60%)                 [structure/anchor-ids]
  ⚠ Page exceeds 4000 token threshold (est. 8,240)    [tokens/page-token-count]
  ℹ No MCP manifest found                             [agent/mcp-detect]

────────────────────────────────────────────────────────────
  Score: 62 / 100  Grade: D
  2 errors  3 warnings  1 info
  12 pages crawled in 2.4s
```

## Why

LLMs and AI agents are the new consumers of your docs, APIs, and marketing pages. But most sites are optimized for humans and search engines — not machines.

AgentLint checks what agents actually care about:
- Can they **discover** your content? (`llms.txt`, sitemaps, OpenAPI specs)
- Can they **read** it efficiently? (markdown support, token counts, boilerplate ratio)
- Is the **structure** parseable? (heading hierarchy, anchor IDs, semantic HTML)
- Are agents **welcome**? (robots.txt policies, MCP manifests, usage guides)

## Install

```bash
# Run directly — no install needed
npx @cjavdev/agent-lint https://example.com

# Or install globally
npm install -g @cjavdev/agent-lint
```

Requires Node.js 18+.

## Usage

```bash
# Basic audit
agent-lint https://example.com

# Crawl deeper
agent-lint https://example.com --max-depth 5 --max-pages 100

# JSON output (for CI pipelines)
agent-lint https://example.com --json

# Agent-friendly markdown report
agent-lint https://example.com --agent
```

### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--max-depth <n>` | `3` | Maximum crawl depth from the start URL |
| `--max-pages <n>` | `30` | Maximum number of pages to crawl |
| `--json` | — | Output structured JSON (see [JSON output](#json-output)) |
| `--agent` | — | Output markdown optimized for LLM consumption |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Audit passed — no errors |
| `1` | Audit failed — errors found |
| `2` | Invalid input or execution error |

Works in CI out of the box. Non-zero exit on errors means your pipeline fails when agent-friendliness degrades.

## Rules

AgentLint ships with 17 rules across 5 categories. Every rule is a pure function — no side effects, no external calls beyond the initial crawl.

### Discoverability

| Rule | Severity | What it checks |
|------|----------|----------------|
| `discoverability/llms-txt` | error | `/llms.txt` exists ([spec](https://llmstxt.org)) |
| `discoverability/sitemap` | warn | `/sitemap.xml` exists |
| `discoverability/openapi-detect` | info | OpenAPI spec at common paths |
| `discoverability/structured-data` | info | JSON-LD structured data on pages |

### Transport

| Rule | Severity | What it checks |
|------|----------|----------------|
| `transport/accept-markdown` | error | Returns markdown when `Accept: text/markdown` is sent |
| `transport/content-type-valid` | warn | Responses have correct `Content-Type` headers |
| `transport/robots-txt` | warn | `robots.txt` exists and doesn't block AI crawlers |

### Structure

| Rule | Severity | What it checks |
|------|----------|----------------|
| `structure/heading-hierarchy` | warn | H1 exists, no skipped heading levels |
| `structure/anchor-ids` | warn | Headings have anchor IDs for deep linking |
| `structure/semantic-html` | info | Uses `<main>`, `<article>`, `<section>` |
| `structure/meta-description` | info | Meta description tag present |
| `structure/lang-attribute` | info | `<html lang="...">` attribute set |

### Tokens

| Rule | Severity | What it checks |
|------|----------|----------------|
| `tokens/page-token-count` | warn | Page under 4,000 tokens (configurable) |
| `tokens/boilerplate-duplication` | warn | Less than 30% repeated nav/header/footer across pages |
| `tokens/nav-ratio` | info | Navigation tokens aren't dominating page content |

### Agent

| Rule | Severity | What it checks |
|------|----------|----------------|
| `agent/mcp-detect` | info | `/.well-known/mcp.json` manifest exists |
| `agent/agent-usage-guide` | warn | Pages mention AI/agent topics |

## Scoring

AgentLint produces a numeric score (0–100) and a letter grade:

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 90–100 | Agent-ready |
| **B** | 80–89 | Minor gaps |
| **C** | 70–79 | Needs work |
| **D** | 60–69 | Significant issues |
| **F** | 0–59 | Not agent-friendly |

**Penalties:** each error costs 10 points, each warning costs 4, each info costs 1.

## Configuration

Create an `agent-lint.config.json` in your project root to customize behavior:

```json
{
  "maxDepth": 5,
  "maxPages": 100,
  "tokenThreshold": 8000,
  "rules": {
    "tokens/page-token-count": { "severity": "info" },
    "agent/mcp-detect": { "enabled": false }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxDepth` | `3` | Maximum crawl depth |
| `maxPages` | `30` | Maximum pages to crawl |
| `tokenThreshold` | `4000` | Token count before warning fires |
| `rules` | `{}` | Per-rule overrides (`severity` or `enabled`) |

## JSON Output

The `--json` flag produces structured output for programmatic use:

```json
{
  "targetUrl": "https://example.com/",
  "score": {
    "score": 75,
    "grade": "C",
    "errors": 1,
    "warnings": 3,
    "infos": 2
  },
  "results": [
    {
      "ruleId": "discoverability/llms-txt",
      "severity": "error",
      "message": "No /llms.txt file found at the site root",
      "url": "https://example.com/llms.txt",
      "remediation": "Create an /llms.txt file per https://llmstxt.org"
    }
  ],
  "pageCount": 12,
  "duration": 2400
}
```

## How It Works

AgentLint runs a linear pipeline:

1. **Crawl** — Deterministic same-origin crawl. Deduplicates URLs, respects depth/page limits, fetches alternate representations (markdown).
2. **Analyze** — Builds a `SiteContext` from crawled pages, auto-discovers and runs all registered rules.
3. **Score** — Computes score from violations. Starts at 100, subtracts per severity.
4. **Report** — Formats output for console, JSON, or agent consumption.

Rules never fetch or produce side effects. All data comes from the crawl phase.

## License

MIT
