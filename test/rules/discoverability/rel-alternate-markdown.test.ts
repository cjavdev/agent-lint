import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/discoverability/rel-alternate-markdown.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(
  url: string,
  overrides?: Partial<CrawledPage>
): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    html: "<html><body>Hello</body></html>",
    textContent: "Hello",
    links: [],
    sizeBytes: 100,
    alternateRepresentations: new Map(),
    relAlternateLinks: [],
    ...overrides,
  };
}

function makeContext(
  pages: CrawledPage[],
  config?: Partial<AgentLintConfig>
): SiteContext {
  return {
    targetUrl: "http://example.com",
    pages,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

describe("discoverability/rel-alternate-markdown", () => {
  it("passes when page has a rel-alternate markdown link", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", {
        html: '<html><head><link rel="alternate" type="text/markdown" href="/page.md"></head><body>Hello</body></html>',
        relAlternateLinks: [
          { type: "text/markdown", href: "http://example.com/page.md" },
        ],
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("fails when page has no rel-alternate markdown link", async () => {
    const ctx = makeContext([makePage("http://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("discoverability/rel-alternate-markdown");
    expect(results[0].severity).toBe("info");
  });

  it("skips non-HTML pages", async () => {
    const ctx = makeContext([
      makePage("http://example.com/sitemap.xml", {
        headers: { "content-type": "application/xml" },
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("ignores rel-alternate links with different types", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", {
        relAlternateLinks: [
          { type: "application/rss+xml", href: "http://example.com/feed.xml" },
        ],
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
  });

  it("only reports violations for pages missing the link", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", {
        relAlternateLinks: [
          { type: "text/markdown", href: "http://example.com/index.md" },
        ],
      }),
      makePage("http://example.com/about"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("http://example.com/about");
  });
});
