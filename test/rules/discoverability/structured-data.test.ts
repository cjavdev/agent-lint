import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/discoverability/structured-data.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(url: string, html: string): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    html,
    textContent: "",
    links: [],
    sizeBytes: html.length,
    alternateRepresentations: new Map(),
    relAlternateLinks: [],
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

describe("discoverability/structured-data", () => {
  it("passes when a page has JSON-LD", async () => {
    const page = makePage(
      "http://example.com",
      '<html><head><script type="application/ld+json">{"@type":"Organization"}</script></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("fails when no page has JSON-LD", async () => {
    const page = makePage(
      "http://example.com",
      "<html><head></head><body><h1>Hello</h1></body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });

  it("passes when JSON-LD exists on any page (not necessarily all)", async () => {
    const page1 = makePage(
      "http://example.com",
      "<html><head></head><body><h1>No structured data</h1></body></html>"
    );
    const page2 = makePage(
      "http://example.com/about",
      '<html><head><script type="application/ld+json">{"@type":"WebPage"}</script></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page1, page2]));
    expect(results).toHaveLength(0);
  });

  it("reports against the origin URL", async () => {
    const page = makePage(
      "http://example.com/some/path",
      "<html><body>No JSON-LD here</body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("http://example.com");
  });

  it("checks rule metadata", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body>Plain page</body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("discoverability/structured-data");
    expect(results[0].severity).toBe("info");
  });

  it("handles empty pages array", async () => {
    const results = await rule.check(makeContext([]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].message).toBe(
      "No JSON-LD structured data found on any page"
    );
  });

  it("ignores other script types", async () => {
    const page = makePage(
      "http://example.com",
      '<html><head><script type="text/javascript">var x = 1;</script></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });
});
