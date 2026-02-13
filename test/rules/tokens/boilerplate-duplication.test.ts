import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/tokens/boilerplate-duplication.js";
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
  config?: Partial<AgentLintConfig>,
): SiteContext {
  return {
    targetUrl: "http://example.com",
    pages,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

// Helper: creates an HTML page with a large nav/footer and a small body
function makeHighBoilerplatePage(url: string): CrawledPage {
  const navText = "Nav link ".repeat(50); // ~450 chars of nav
  const footerText = "Footer link ".repeat(50); // ~600 chars of footer
  const bodyText = "Content."; // tiny body content
  const html = `<html><body><nav>${navText}</nav><main>${bodyText}</main><footer>${footerText}</footer></body></html>`;
  return makePage(url, html);
}

// Helper: creates an HTML page with minimal boilerplate and lots of content
function makeLowBoilerplatePage(url: string): CrawledPage {
  const navText = "Home About";
  const bodyText = "Interesting article content. ".repeat(100); // ~2900 chars
  const html = `<html><body><nav>${navText}</nav><main>${bodyText}</main></body></html>`;
  return makePage(url, html);
}

describe("tokens/boilerplate-duplication", () => {
  it("passes when boilerplate ratio is under 30%", async () => {
    const ctx = makeContext([
      makeLowBoilerplatePage("http://example.com/"),
      makeLowBoilerplatePage("http://example.com/about"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("warns when boilerplate ratio exceeds 30%", async () => {
    const ctx = makeContext([
      makeHighBoilerplatePage("http://example.com/"),
      makeHighBoilerplatePage("http://example.com/about"),
    ]);
    const results = await rule.check(ctx);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const result of results) {
      expect(result.severity).toBe("warn");
      expect(result.ruleId).toBe("tokens/boilerplate-duplication");
      expect(result.message).toContain("boilerplate");
      expect(result.message).toContain("30%");
    }
  });

  it("skips when only 1 page is present", async () => {
    const ctx = makeContext([
      makeHighBoilerplatePage("http://example.com/"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("includes correct ruleId, severity, and url in results", async () => {
    const ctx = makeContext([
      makeHighBoilerplatePage("http://example.com/page1"),
      makeHighBoilerplatePage("http://example.com/page2"),
    ]);
    const results = await rule.check(ctx);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const urls = results.map((r) => r.url);
    expect(urls).toContain("http://example.com/page1");
    expect(urls).toContain("http://example.com/page2");

    for (const result of results) {
      expect(result.ruleId).toBe("tokens/boilerplate-duplication");
      expect(result.severity).toBe("warn");
    }
  });

  it("handles pages with no nav/header/footer elements (should pass)", async () => {
    const html1 =
      '<html><body><main><p>Lots of content here. </p><p>' +
      "More content. ".repeat(100) +
      "</p></main></body></html>";
    const html2 =
      '<html><body><div><p>Another page of content. </p><p>' +
      "Even more content. ".repeat(100) +
      "</p></div></body></html>";
    const ctx = makeContext([
      makePage("http://example.com/a", html1),
      makePage("http://example.com/b", html2),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("metadata includes the ratio percentage", async () => {
    const ctx = makeContext([
      makeHighBoilerplatePage("http://example.com/"),
      makeHighBoilerplatePage("http://example.com/about"),
    ]);
    const results = await rule.check(ctx);
    expect(results.length).toBeGreaterThanOrEqual(1);

    for (const result of results) {
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.percentage).toBeDefined();
      expect(typeof result.metadata!.percentage).toBe("number");
      expect(result.metadata!.boilerplateRatio).toBeDefined();
      expect(typeof result.metadata!.boilerplateRatio).toBe("number");
      expect(result.metadata!.averageRatio).toBeDefined();
      expect(typeof result.metadata!.averageRatio).toBe("number");
      expect((result.metadata!.percentage as number)).toBeGreaterThan(30);
    }
  });

  it("only warns for pages above threshold when average exceeds 30%", async () => {
    // Mix: one high-boilerplate page, one low-boilerplate page
    // The average might or might not exceed 30% depending on content ratio
    const ctx = makeContext([
      makeHighBoilerplatePage("http://example.com/heavy"),
      makeLowBoilerplatePage("http://example.com/light"),
    ]);
    const results = await rule.check(ctx);

    // Even if there are warnings, they should only be for the heavy page
    for (const result of results) {
      if (result.url) {
        // Each warned page should have ratio > 30%
        expect(
          (result.metadata!.boilerplateRatio as number),
        ).toBeGreaterThan(0.3);
      }
    }
  });

  it("handles empty pages gracefully", async () => {
    const ctx = makeContext([
      makePage("http://example.com/empty1", "<html><body></body></html>"),
      makePage("http://example.com/empty2", "<html><body></body></html>"),
    ]);
    const results = await rule.check(ctx);
    // Empty pages have no text, so ratio computation is skipped
    expect(results).toHaveLength(0);
  });

  it("includes remediation in results", async () => {
    const ctx = makeContext([
      makeHighBoilerplatePage("http://example.com/"),
      makeHighBoilerplatePage("http://example.com/about"),
    ]);
    const results = await rule.check(ctx);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const result of results) {
      expect(result.remediation).toBeDefined();
      expect(result.remediation).toContain("navigation");
    }
  });
});
