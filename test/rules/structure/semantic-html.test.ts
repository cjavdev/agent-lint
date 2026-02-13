import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/structure/semantic-html.js";
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

describe("structure/semantic-html", () => {
  it("passes when page has <main>", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body><main><p>Content</p></main></body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("passes when page has <article>", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body><article><p>Content</p></article></body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("passes when page has <section>", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body><section><p>Content</p></section></body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("fails when page has no semantic elements", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body><div><p>Content</p></div></body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].message).toContain("lacks semantic HTML landmarks");
  });

  it("passes when page has multiple semantic elements", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body><main><article><p>Content</p></article></main></body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("reports per page", async () => {
    const goodPage = makePage(
      "http://example.com/good",
      "<html><body><main><p>Content</p></main></body></html>"
    );
    const badPage = makePage(
      "http://example.com/bad",
      "<html><body><div><p>Content</p></div></body></html>"
    );
    const results = await rule.check(makeContext([goodPage, badPage]));
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("http://example.com/bad");
  });

  it("checks rule metadata", () => {
    expect(rule.id).toBe("structure/semantic-html");
    expect(rule.severity).toBe("info");
  });
});
