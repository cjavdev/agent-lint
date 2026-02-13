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
  remediation: "Fix it",
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

const urlFailingRule: AgentLintRule = {
  id: "test/url-fail",
  category: "test",
  severity: "warn",
  description: "Fails with URLs",
  remediation: "Fix URLs",
  async check() {
    return [
      {
        ruleId: "test/url-fail",
        severity: "warn",
        message: "Issue on admin page",
        url: "https://example.com/admin/settings",
      },
      {
        ruleId: "test/url-fail",
        severity: "warn",
        message: "Issue on blog page",
        url: "https://example.com/blog/post-1",
      },
      {
        ruleId: "test/url-fail",
        severity: "warn",
        message: "Site-wide issue (no URL)",
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

  it("filters results by rule-level ignorePaths", async () => {
    const ctx: SiteContext = {
      targetUrl: "https://example.com",
      pages: [makePage("https://example.com/")],
      config: {
        ...DEFAULT_CONFIG,
        rules: {
          "test/url-fail": { ignorePaths: ["/admin/*"] },
        },
      },
    };

    const results = await analyze(ctx, [urlFailingRule]);
    // admin page filtered out, blog page and no-url result remain
    expect(results).toHaveLength(2);
    expect(results.some((r) => r.url?.includes("/admin/"))).toBe(false);
    expect(results.some((r) => r.url?.includes("/blog/"))).toBe(true);
    expect(results.some((r) => !r.url)).toBe(true);
  });

  it("filters results by global ignorePatterns", async () => {
    const ctx: SiteContext = {
      targetUrl: "https://example.com",
      pages: [makePage("https://example.com/")],
      config: {
        ...DEFAULT_CONFIG,
        ignorePatterns: ["/blog/*"],
        rules: {},
      },
    };

    const results = await analyze(ctx, [urlFailingRule]);
    // blog page filtered out, admin page and no-url result remain
    expect(results).toHaveLength(2);
    expect(results.some((r) => r.url?.includes("/blog/"))).toBe(false);
    expect(results.some((r) => r.url?.includes("/admin/"))).toBe(true);
  });

  it("does not filter results without a URL (site-wide checks)", async () => {
    const ctx: SiteContext = {
      targetUrl: "https://example.com",
      pages: [makePage("https://example.com/")],
      config: {
        ...DEFAULT_CONFIG,
        ignorePatterns: ["/**"], // ignore everything
        rules: {},
      },
    };

    const results = await analyze(ctx, [urlFailingRule]);
    // Only the no-url result should remain
    expect(results).toHaveLength(1);
    expect(results[0].url).toBeUndefined();
  });
});
