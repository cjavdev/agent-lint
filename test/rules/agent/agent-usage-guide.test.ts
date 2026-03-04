import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/agent/agent-usage-guide.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(url: string, textContent: string): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    html: `<html><body>${textContent}</body></html>`,
    textContent,
    links: [],
    sizeBytes: textContent.length,
    alternateRepresentations: new Map(),
    relAlternateLinks: [],
  };
}

function makeContext(
  pages: CrawledPage[],
  targetUrl = "https://example.com",
  config?: Partial<AgentLintConfig>
): SiteContext {
  return {
    targetUrl,
    pages,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

describe("agent/agent-usage-guide", () => {
  it("warns when no pages mention any AI/agent keywords", async () => {
    const ctx = makeContext([
      makePage("https://example.com/", "Welcome to our site."),
      makePage("https://example.com/about", "About us page with no relevant terms."),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("No pages mention AI/agent-related keywords");
  });

  it("passes when at least one page mentions 'ai agent' (case insensitive)", async () => {
    const ctx = makeContext([
      makePage("https://example.com/", "Welcome to our site."),
      makePage(
        "https://example.com/docs",
        "This page describes how an AI Agent can use our API."
      ),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("passes when a page mentions 'llm'", async () => {
    const ctx = makeContext([
      makePage(
        "https://example.com/",
        "Our site is optimized for LLM consumption."
      ),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("passes when a page mentions 'programmatic access'", async () => {
    const ctx = makeContext([
      makePage(
        "https://example.com/api",
        "We offer programmatic access to all resources."
      ),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("emits at most 1 result even with many pages", async () => {
    const ctx = makeContext([
      makePage("https://example.com/", "Home page."),
      makePage("https://example.com/about", "About page."),
      makePage("https://example.com/docs", "Documentation."),
      makePage("https://example.com/api", "API reference."),
      makePage("https://example.com/blog", "Blog posts."),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
  });

  it("result url points to targetUrl", async () => {
    const ctx = makeContext(
      [makePage("https://example.com/", "Nothing relevant here.")],
      "https://example.com"
    );
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://example.com");
  });

  it("has correct ruleId and severity", async () => {
    const ctx = makeContext([
      makePage("https://example.com/", "Just a regular page."),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("agent/agent-usage-guide");
    expect(results[0].severity).toBe("warn");
  });

  it("case-insensitive matching works (e.g., 'AI Agent', 'LLM')", async () => {
    const upperCaseCtx = makeContext([
      makePage("https://example.com/", "Our AI AGENT integration guide."),
    ]);
    expect(await rule.check(upperCaseCtx)).toHaveLength(0);

    const mixedCaseCtx = makeContext([
      makePage("https://example.com/", "Designed for LLM workflows."),
    ]);
    expect(await rule.check(mixedCaseCtx)).toHaveLength(0);

    const lowerCaseCtx = makeContext([
      makePage("https://example.com/", "Read our bot policy before scraping."),
    ]);
    expect(await rule.check(lowerCaseCtx)).toHaveLength(0);
  });
});
