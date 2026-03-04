import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/agent/mcp-detect.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(url: string): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "application/json" },
    html: "",
    textContent: "",
    links: [],
    sizeBytes: 100,
    alternateRepresentations: new Map(),
    relAlternateLinks: [],
  };
}

function makeContext(
  pages: CrawledPage[],
  targetUrl = "https://example.com",
  config?: Partial<AgentLintConfig>
): SiteContext {
  return {
    targetUrl,
    pages,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

describe("agent/mcp-detect", () => {
  it("emits info when no MCP manifest found", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/about"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("agent/mcp-detect");
    expect(results[0].message).toBe(
      "No MCP manifest found at /.well-known/mcp.json"
    );
    expect(results[0].url).toBe(
      "https://example.com/.well-known/mcp.json"
    );
  });

  it("passes when /.well-known/mcp.json exists", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/.well-known/mcp.json"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("works with targetUrl that has a path", async () => {
    const ctx = makeContext(
      [makePage("https://example.com/docs")],
      "https://example.com/docs"
    );
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    // Should report against the origin, not the path
    expect(results[0].url).toBe(
      "https://example.com/.well-known/mcp.json"
    );
  });

  it("emits at most 1 result even with many pages", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/about"),
      makePage("https://example.com/docs"),
      makePage("https://example.com/api"),
      makePage("https://example.com/blog"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
  });

  it("severity is info", async () => {
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });
});
