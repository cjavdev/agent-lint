import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/structure/anchor-ids.js";
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

describe("structure/anchor-ids", () => {
  it("passes when all headings have id attributes", async () => {
    const html = `
      <html><body>
        <h1 id="title">Title</h1>
        <h2 id="section-one">Section One</h2>
        <h3 id="subsection">Subsection</h3>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("fails when headings lack anchor IDs (reports count and percentage)", async () => {
    const html = `
      <html><body>
        <h1 id="title">Title</h1>
        <h2>No ID One</h2>
        <h2>No ID Two</h2>
        <h3>No ID Three</h3>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("structure/anchor-ids");
    expect(results[0].severity).toBe("warn");
    expect(results[0].message).toBe(
      "3 of 4 headings (75%) lack anchor IDs for deep linking"
    );
    expect(results[0].url).toBe("http://example.com/");
    expect(results[0].metadata).toEqual({
      missing: 3,
      total: 4,
      percentage: 75,
    });
  });

  it("detects id on heading element directly", async () => {
    const html = `
      <html><body>
        <h1 id="main-title">Title</h1>
        <h2 id="intro">Intro</h2>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it('detects <a name="..."> child anchor', async () => {
    const html = `
      <html><body>
        <h1><a name="title"></a>Title</h1>
        <h2><a name="section">Section</a></h2>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it('detects <a id="..."> child anchor', async () => {
    const html = `
      <html><body>
        <h1><a id="title"></a>Title</h1>
        <h2><a id="section">Section</a></h2>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it('treats empty id="" as missing', async () => {
    const html = `
      <html><body>
        <h1 id="">Title</h1>
        <h2 id="">Section</h2>
        <h3><a name="">Subsection</a></h3>
        <h4><a id="">Deep</a></h4>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe(
      "4 of 4 headings (100%) lack anchor IDs for deep linking"
    );
  });

  it("skips pages with no headings (no violation)", async () => {
    const html = `
      <html><body>
        <p>Just a paragraph with no headings.</p>
        <div>Some content</div>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("handles multiple pages", async () => {
    const goodHtml = `
      <html><body>
        <h1 id="title">Title</h1>
        <h2 id="section">Section</h2>
      </body></html>
    `;
    const badHtml = `
      <html><body>
        <h1>Title</h1>
        <h2>Section</h2>
      </body></html>
    `;
    const noHeadingsHtml = `
      <html><body><p>No headings here.</p></body></html>
    `;
    const ctx = makeContext([
      makePage("http://example.com/good", goodHtml),
      makePage("http://example.com/bad", badHtml),
      makePage("http://example.com/empty", noHeadingsHtml),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("http://example.com/bad");
  });

  it("reports one violation per page (not per heading)", async () => {
    const html = `
      <html><body>
        <h1>No ID 1</h1>
        <h2>No ID 2</h2>
        <h3>No ID 3</h3>
        <h4>No ID 4</h4>
        <h5>No ID 5</h5>
      </body></html>
    `;
    const ctx = makeContext([makePage("http://example.com/", html)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe(
      "5 of 5 headings (100%) lack anchor IDs for deep linking"
    );
  });
});
