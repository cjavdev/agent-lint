import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/structure/heading-hierarchy.js";
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

describe("structure/heading-hierarchy", () => {
  it("passes when headings are properly ordered (h1 -> h2 -> h3)", async () => {
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        "<html><body><h1>Title</h1><h2>Section</h2><h3>Sub</h3></body></html>"
      ),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("fails when no h1 exists", async () => {
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        "<html><body><h2>Section</h2><h3>Sub</h3></body></html>"
      ),
    ]);
    const results = await rule.check(ctx);
    const missingH1 = results.filter((r) =>
      r.message.includes("missing an <h1>")
    );
    expect(missingH1).toHaveLength(1);
    expect(missingH1[0].severity).toBe("warn");
    expect(missingH1[0].url).toBe("http://example.com/");
  });

  it("fails when heading levels are skipped (h1 -> h3)", async () => {
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        "<html><body><h1>Title</h1><h3>Skipped</h3></body></html>"
      ),
    ]);
    const results = await rule.check(ctx);
    const skipped = results.filter((r) => r.message.includes("skipped"));
    expect(skipped).toHaveLength(1);
    expect(skipped[0].message).toContain("h1");
    expect(skipped[0].message).toContain("h3");
    expect(skipped[0].message).toContain("Skipped");
    expect(skipped[0].ruleId).toBe("structure/heading-hierarchy");
  });

  it("allows decreasing heading levels (h3 -> h1)", async () => {
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        "<html><body><h1>Title</h1><h2>A</h2><h3>B</h3><h1>New Section</h1><h2>C</h2></body></html>"
      ),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("handles multiple pages", async () => {
    const ctx = makeContext([
      makePage(
        "http://example.com/good",
        "<html><body><h1>Title</h1><h2>Section</h2></body></html>"
      ),
      makePage(
        "http://example.com/bad",
        "<html><body><h2>No H1</h2></body></html>"
      ),
      makePage(
        "http://example.com/skip",
        "<html><body><h1>Title</h1><h4>Big skip</h4></body></html>"
      ),
    ]);
    const results = await rule.check(ctx);
    // bad page: missing h1 + skip (h2 starts at level 0) = 2 violations
    // skip page: skip from h1 to h4 = 1 violation
    expect(results.length).toBeGreaterThanOrEqual(3);

    const badPageResults = results.filter(
      (r) => r.url === "http://example.com/bad"
    );
    expect(badPageResults.length).toBeGreaterThanOrEqual(1);

    const skipPageResults = results.filter(
      (r) => r.url === "http://example.com/skip"
    );
    expect(skipPageResults.length).toBeGreaterThanOrEqual(1);
  });

  it("handles pages with no headings (no violations)", async () => {
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        "<html><body><p>Just a paragraph</p></body></html>"
      ),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("truncates long heading text in messages", async () => {
    const longText = "A".repeat(200);
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        `<html><body><h1>Title</h1><h3>${longText}</h3></body></html>`
      ),
    ]);
    const results = await rule.check(ctx);
    const skipped = results.filter((r) => r.message.includes("skipped"));
    expect(skipped).toHaveLength(1);
    // The heading text in the message should be truncated to 80 chars
    expect(skipped[0].metadata?.text).toHaveLength(80);
    expect((skipped[0].metadata?.text as string).endsWith("\u2026")).toBe(true);
  });

  it("reports both missing h1 and skipped level for h2-only page", async () => {
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        "<html><body><h2>Only H2</h2></body></html>"
      ),
    ]);
    const results = await rule.check(ctx);
    const missingH1 = results.filter((r) =>
      r.message.includes("missing an <h1>")
    );
    const skipped = results.filter((r) => r.message.includes("skipped"));
    expect(missingH1).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });
});
