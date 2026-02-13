# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is AgentLint

AgentLint is a CLI tool that audits public websites and documentation domains for AI/agent-friendliness. It crawls a site, applies lint rules, and outputs structured violations with a numeric AgentScore (0–100). Runnable via `npx agentlint https://example.com`.

## Tech Stack

- Node.js (latest LTS), TypeScript, ESM modules
- `commander` for CLI parsing, native `fetch` (Node 18+)
- `cheerio` for HTML parsing, `chalk` for CLI formatting, `ora` for spinners
- `zod` for config validation
- `tiktoken` (or compatible) for token counting

## Build & Dev Commands

```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript to dist/
npm run dev              # Run CLI in development (ts-node/tsx)
npm test                 # Run full test suite
npm test -- --grep "transport"  # Run tests matching pattern
npm run lint             # Lint with ESLint
```

Run the CLI locally during development:
```bash
npx tsx src/cli.ts https://example.com
npx tsx src/cli.ts https://example.com --json
npx tsx src/cli.ts https://example.com --max-depth 3 --max-pages 50
```

## Architecture

### Pipeline

The entire system is a linear pipeline: **CLI entry → Crawl → Normalize → Run Rules → Aggregate → Score → Report**

1. `src/cli.ts` — Entry point. Parses args via commander, loads config, orchestrates pipeline.
2. `src/core/crawler.ts` — Deterministic same-origin crawler. Returns `CrawledPage[]` with url, status, headers, html, textContent, links, sizeBytes.
3. `src/core/analyzer.ts` — Builds `SiteContext` from crawled pages, then runs all registered rules against it.
4. `src/core/scorer.ts` — Computes score: starts at 100, subtracts 10/error, 4/warning, 1/info. Clamps 0–100. Maps to letter grade.
5. `src/core/tokenizer.ts` — Token counting abstraction used by token efficiency rules.
6. `src/reporters/console.ts` and `src/reporters/json.ts` — Format output for human-readable or `--json` mode.

### Rule System

Rules live in `src/rules/{category}/` with categories: `transport`, `structure`, `tokens`, `discoverability`, `agent`.

Every rule implements the `AgentLintRule` interface:

```typescript
interface AgentLintRule {
  id: string           // e.g. "transport/accept-markdown"
  category: string
  severity: "error" | "warn" | "info"
  description: string
  check(context: SiteContext): Promise<RuleResult[]>
}
```

Rules are **auto-registered** — adding a new rule file to a category directory should automatically include it in analysis. No manual registration step.

### Key Types

All shared types live in `src/types.ts`. The `SiteContext` type is the primary input to rules — it contains all crawled pages and site-wide metadata. `RuleResult` is what rules return (message, optional url, optional metadata).

### Configuration

Optional `agentlint.config.json` at project root. Validated with zod. Supports: `maxDepth`, `maxPages`, `tokenThreshold`, per-rule severity overrides.

## Design Principles

- **Rules are pure functions** of `SiteContext` — no side effects, no fetching. All data comes from the crawl phase.
- **Crawler is deterministic** — same input produces same crawl order. Respects same-origin, deduplicates URLs, configurable depth/page limits.
- **Exit codes matter** — non-zero exit when errors are present (CI integration).
- **Extensibility over cleverness** — designed for future plugin system, GitHub Action, badge generation.

## Rule Categories and IDs

| Category | Rule ID | Severity | What It Checks |
|----------|---------|----------|----------------|
| transport | `transport/accept-markdown` | error | Site returns markdown when `Accept: text/markdown` is sent |
| transport | `transport/content-type-valid` | warn | Response has correct content-type header |
| discoverability | `discoverability/llms-txt` | error | `/llms.txt` exists |
| discoverability | `discoverability/sitemap` | warn | `/sitemap.xml` exists |
| discoverability | `discoverability/openapi-detect` | info | OpenAPI spec at common paths |
| structure | `structure/heading-hierarchy` | warn | H1 exists, no skipped heading levels |
| structure | `structure/anchor-ids` | warn | Headers have anchor IDs |
| tokens | `tokens/page-token-count` | warn | Page under 4000 tokens (configurable) |
| tokens | `tokens/boilerplate-duplication` | warn | <30% repeated nav/footer content across pages |
| tokens | `tokens/nav-ratio` | info | Navigation token percentage |
| agent | `agent/mcp-detect` | info | `/.well-known/mcp.json` exists |
| agent | `agent/agent-usage-guide` | warn | Pages mention AI/agent keywords |
