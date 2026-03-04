import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/structure/meta-description.js";
import type { CrawledPage, SiteContext, AgentLintConfig } from "../../../src/types.js";
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

function makeContext(pages: CrawledPage[], config?: Partial<AgentLintConfig>): SiteContext {
  return {
    targetUrl: "http://example.com",
    pages,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

describe("structure/meta-description", () => {
  it("passes when meta description is present", async () => {
    const page = makePage(
      "http://example.com",
      '<html><head><meta name="description" content="A page about things"></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("fails when meta description is missing", async () => {
    const page = makePage(
      "http://example.com",
      "<html><head></head><body></body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].ruleId).toBe("structure/meta-description");
  });

  it("fails when meta description has empty content", async () => {
    const page = makePage(
      "http://example.com",
      '<html><head><meta name="description" content=""></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });

  it("fails when meta description content is whitespace only", async () => {
    const page = makePage(
      "http://example.com",
      '<html><head><meta name="description" content="   "></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });

  it("handles case-insensitive name attribute", async () => {
    const page = makePage(
      "http://example.com",
      '<html><head><meta name="Description" content="Works"></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("reports per page", async () => {
    const pageWith = makePage(
      "http://example.com/with",
      '<html><head><meta name="description" content="Has description"></head><body></body></html>'
    );
    const pageWithout = makePage(
      "http://example.com/without",
      "<html><head></head><body></body></html>"
    );
    const results = await rule.check(makeContext([pageWith, pageWithout]));
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("http://example.com/without");
  });

  it("ignores other meta tags", async () => {
    const page = makePage(
      "http://example.com",
      '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });
});
