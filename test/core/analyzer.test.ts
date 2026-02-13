import { describe, it, expect } from "vitest";
import {
  buildSiteContext,
  discoverRules,
  analyze,
} from "../../src/core/analyzer.js";
import type {
  AgentLintRule,
  CrawledPage,
  SiteContext,
} from "../../src/types.js";
import { DEFAULT_CONFIG } from "../../src/types.js";

function makePage(url: string): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    html: "<html><body>Hello</body></html>",
    textContent: "Hello",
    links: [],
    sizeBytes: 100,
    alternateRepresentations: new Map(),
  };
}

const passingRule: AgentLintRule = {
  id: "test/pass",
  category: "test",
  severity: "error",
  description: "Always passes",
  async check() {
    return [];
  },
};

const failingRule: AgentLintRule = {
  id: "test/fail",
  category: "test",
  severity: "error",
  description: "Always fails",
  async check() {
    return [
      {
        ruleId: "test/fail",
        severity: "error",
        message: "This rule always fails",
      },
    ];
  },
};

describe("buildSiteContext", () => {
  it("builds context with defaults", () => {
    const pages = [makePage("http://example.com/")];
    const ctx = buildSiteContext("http://example.com", pages);
    expect(ctx.targetUrl).toBe("http://example.com");
    expect(ctx.pages).toBe(pages);
    expect(ctx.config.maxDepth).toBe(DEFAULT_CONFIG.maxDepth);
  });

  it("merges config overrides", () => {
    const ctx = buildSiteContext("http://example.com", [], {
      maxDepth: 5,
    });
    expect(ctx.config.maxDepth).toBe(5);
    expect(ctx.config.maxPages).toBe(DEFAULT_CONFIG.maxPages);
  });
});

describe("discoverRules", () => {
  it("discovers rules from the real rules directory", async () => {
    const rules = await discoverRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.id === "transport/accept-markdown")).toBe(true);
  });

  it("returns empty array for non-existent directory", async () => {
    const rules = await discoverRules("/nonexistent/path");
    expect(rules).toHaveLength(0);
  });
});

describe("analyze", () => {
  it("collects results from all rules", async () => {
    const ctx: SiteContext = {
      targetUrl: "http://example.com",
      pages: [makePage("http://example.com/")],
      config: DEFAULT_CONFIG,
    };

    const results = await analyze(ctx, [passingRule, failingRule]);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("test/fail");
  });

  it("skips disabled rules", async () => {
    const ctx: SiteContext = {
      targetUrl: "http://example.com",
      pages: [makePage("http://example.com/")],
      config: {
        ...DEFAULT_CONFIG,
        rules: { "test/fail": { enabled: false } },
      },
    };

    const results = await analyze(ctx, [failingRule]);
    expect(results).toHaveLength(0);
  });

  it("applies severity overrides", async () => {
    const ctx: SiteContext = {
      targetUrl: "http://example.com",
      pages: [makePage("http://example.com/")],
      config: {
        ...DEFAULT_CONFIG,
        rules: { "test/fail": { severity: "warn" } },
      },
    };

    const results = await analyze(ctx, [failingRule]);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warn");
  });
});
