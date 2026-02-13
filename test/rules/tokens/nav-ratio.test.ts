import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/tokens/nav-ratio.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(url: string, html: string, textContent: string): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    html,
    textContent,
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

describe("tokens/nav-ratio", () => {
  it("passes when nav ratio is under 20%", async () => {
    // Nav text: 40 chars => 10 tokens. Body text: 1000 chars => 250 tokens total.
    // Ratio: 10/250 = 4% — well under 20%.
    const navText = "a".repeat(40);
    const bodyText = "b".repeat(960);
    const html = `<html><body><nav>${navText}</nav><main>${bodyText}</main></body></html>`;
    const textContent = navText + bodyText;

    const ctx = makeContext([makePage("http://example.com/", html, textContent)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("emits info when nav ratio exceeds 20%", async () => {
    // Nav text: 400 chars => 100 tokens. Total text: 500 chars => 125 tokens.
    // Ratio: 100/125 = 80% — well over 20%.
    const navText = "a".repeat(400);
    const bodyText = "b".repeat(100);
    const html = `<html><body><nav>${navText}</nav><main>${bodyText}</main></body></html>`;
    const textContent = navText + bodyText;

    const ctx = makeContext([makePage("http://example.com/heavy-nav", html, textContent)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].ruleId).toBe("tokens/nav-ratio");
    expect(results[0].url).toBe("http://example.com/heavy-nav");
    expect(results[0].message).toContain("80.0%");
  });

  it("handles pages with no <nav> element", async () => {
    const bodyText = "c".repeat(1000);
    const html = `<html><body><main>${bodyText}</main></body></html>`;
    const textContent = bodyText;

    const ctx = makeContext([makePage("http://example.com/no-nav", html, textContent)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("skips pages with empty textContent", async () => {
    const html = `<html><body><nav>Some nav</nav></body></html>`;
    const textContent = "";

    const ctx = makeContext([makePage("http://example.com/empty", html, textContent)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("includes navRatio, navTokens, and totalTokens in metadata", async () => {
    // Nav text: 200 chars => 50 tokens. Total text: 400 chars => 100 tokens.
    // Ratio: 50/100 = 0.5 (50%).
    const navText = "x".repeat(200);
    const bodyText = "y".repeat(200);
    const html = `<html><body><nav>${navText}</nav><main>${bodyText}</main></body></html>`;
    const textContent = navText + bodyText;

    const ctx = makeContext([makePage("http://example.com/meta", html, textContent)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].metadata).toBeDefined();
    expect(results[0].metadata!.navRatio).toBe(0.5);
    expect(results[0].metadata!.navTokens).toBe(50);
    expect(results[0].metadata!.totalTokens).toBe(100);
  });

  it("has correct ruleId and severity", () => {
    expect(rule.id).toBe("tokens/nav-ratio");
    expect(rule.severity).toBe("info");
    expect(rule.category).toBe("tokens");
  });
});
