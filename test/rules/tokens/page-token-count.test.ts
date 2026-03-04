import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/tokens/page-token-count.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(url: string, textContent: string): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "text/html" },
    html: `<html><body>${textContent}</body></html>`,
    textContent,
    links: [],
    sizeBytes: textContent.length,
    alternateRepresentations: new Map(),
    relAlternateLinks: [],
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

describe("tokens/page-token-count", () => {
  it("passes when page is under threshold", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", "Short text content."),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("warns when page exceeds default 4000 token threshold", async () => {
    // 16001 chars / 4 = 4001 tokens, exceeds 4000
    const longText = "a".repeat(16001);
    const ctx = makeContext([makePage("http://example.com/long", longText)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warn");
    expect(results[0].ruleId).toBe("tokens/page-token-count");
    expect(results[0].url).toBe("http://example.com/long");
    expect(results[0].message).toContain("4001");
    expect(results[0].message).toContain("4000");
  });

  it("respects custom tokenThreshold from config", async () => {
    // 401 chars / 4 = 101 tokens, exceeds custom threshold of 100
    const text = "a".repeat(401);
    const ctx = makeContext(
      [makePage("http://example.com/custom", text)],
      { tokenThreshold: 100 },
    );
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("101");
    expect(results[0].message).toContain("100");
  });

  it("includes estimatedTokens and threshold in metadata", async () => {
    const text = "a".repeat(16001);
    const ctx = makeContext([makePage("http://example.com/meta", text)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].metadata).toBeDefined();
    expect(results[0].metadata!.estimatedTokens).toBe(4001);
    expect(results[0].metadata!.threshold).toBe(4000);
  });

  it("handles multiple pages (mix of over and under threshold)", async () => {
    const shortText = "Hello world";
    const longText = "b".repeat(20000); // 5000 tokens
    const ctx = makeContext([
      makePage("http://example.com/short", shortText),
      makePage("http://example.com/long", longText),
      makePage("http://example.com/also-short", "Tiny page"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("http://example.com/long");
  });

  it("passes when page is exactly at threshold", async () => {
    // Exactly 4000 tokens = 16000 chars
    const exactText = "c".repeat(16000);
    const ctx = makeContext([makePage("http://example.com/exact", exactText)]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });
});
