import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/transport/accept-markdown.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
  AlternateResponse,
  RelAlternateLink,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(
  url: string,
  alternate?: Partial<AlternateResponse> | "none",
  relAlternateLinks: RelAlternateLink[] = []
): CrawledPage {
  const page: CrawledPage = {
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    html: "<html><body>Hello</body></html>",
    textContent: "Hello",
    links: [],
    sizeBytes: 100,
    alternateRepresentations: new Map(),
    relAlternateLinks,
  };

  if (alternate !== "none") {
    page.alternateRepresentations.set("text/markdown", {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8" },
      body: "# Hello",
      contentType: "text/markdown; charset=utf-8",
      ...alternate,
    });
  }

  return page;
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

describe("transport/accept-markdown", () => {
  it("passes when valid markdown is returned", async () => {
    const ctx = makeContext([makePage("http://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("fails when alternate response map has no markdown entry", async () => {
    const ctx = makeContext([makePage("http://example.com/", "none")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("transport/accept-markdown");
    expect(results[0].severity).toBe("error");
  });

  it("fails when markdown request returns non-2xx", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", { status: 406, body: "Not Acceptable" }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("406");
  });

  it("fails when response body is HTML", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", {
        body: "<!DOCTYPE html><html><body>Hello</body></html>",
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("recognizable markdown");
  });

  it("passes with text/plain content-type if body is markdown", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", {
        contentType: "text/plain",
        headers: { "content-type": "text/plain" },
        body: "# Title\n\n- Item 1\n- Item 2\n\n[Link](http://example.com)",
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("handles multiple pages", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", "none"), // no alternate → fail
      makePage("http://example.com/good"), // valid markdown → pass
      makePage("http://example.com/bad", { status: 404, body: "Not Found" }), // 404 → fail
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(2);
  });

  it("downgrades to warn when no content negotiation but rel-alternate exists", async () => {
    const relLinks: RelAlternateLink[] = [
      { type: "text/markdown", href: "http://example.com/page.md" },
    ];
    const ctx = makeContext([makePage("http://example.com/", "none", relLinks)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warn");
    expect(results[0].message).toContain("rel=\"alternate\"");
  });

  it("downgrades to warn when non-2xx but rel-alternate exists", async () => {
    const relLinks: RelAlternateLink[] = [
      { type: "text/markdown", href: "http://example.com/page.md" },
    ];
    const ctx = makeContext([
      makePage("http://example.com/", { status: 406, body: "Not Acceptable" }, relLinks),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warn");
    expect(results[0].message).toContain("406");
    expect(results[0].message).toContain("rel=\"alternate\"");
  });

  it("downgrades to warn when HTML body but rel-alternate exists", async () => {
    const relLinks: RelAlternateLink[] = [
      { type: "text/markdown", href: "http://example.com/page.md" },
    ];
    const ctx = makeContext([
      makePage(
        "http://example.com/",
        { body: "<!DOCTYPE html><html><body>Hello</body></html>" },
        relLinks
      ),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warn");
  });

  it("detects various markdown patterns", async () => {
    const bodies = [
      "# Heading",
      "- List item",
      "1. Ordered item",
      "[Link](http://example.com)",
      "```\ncode block\n```",
      "> Blockquote",
    ];

    for (const body of bodies) {
      const ctx = makeContext([makePage("http://example.com/", { body })]);
      const results = await rule.check(ctx);
      expect(results).toHaveLength(0);
    }
  });
});
