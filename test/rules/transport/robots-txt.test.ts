import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/transport/robots-txt.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(
  url: string,
  html: string,
  textContent?: string
): CrawledPage {
  return {
    url,
    status: 200,
    headers: { "content-type": "text/plain" },
    html,
    textContent: textContent ?? html,
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

describe("transport/robots-txt", () => {
  it("warns when robots.txt is missing", async () => {
    const context = makeContext([
      makePage("http://example.com/", "<html></html>"),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("warn");
    expect(results[0].message).toContain("No /robots.txt found");
  });

  it("passes when robots.txt exists with no AI blocks", async () => {
    const robotsContent = [
      "User-agent: *",
      "Allow: /",
      "",
      "Sitemap: http://example.com/sitemap.xml",
    ].join("\n");

    const context = makeContext([
      makePage("http://example.com/", "<html></html>"),
      makePage("http://example.com/robots.txt", robotsContent),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(0);
  });

  it("detects wildcard block (User-agent: * / Disallow: /)", async () => {
    const robotsContent = [
      "User-agent: *",
      "Disallow: /",
    ].join("\n");

    const context = makeContext([
      makePage("http://example.com/robots.txt", robotsContent),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].message).toContain("blocks all user agents");
    expect(results[0].metadata).toEqual({ agent: "*" });
  });

  it("detects specific AI agent block (GPTBot)", async () => {
    const robotsContent = [
      "User-agent: GPTBot",
      "Disallow: /",
    ].join("\n");

    const context = makeContext([
      makePage("http://example.com/robots.txt", robotsContent),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
    expect(results[0].message).toContain('blocks AI agent "GPTBot"');
    expect(results[0].metadata).toEqual({ agent: "GPTBot" });
  });

  it("detects multiple AI agent blocks", async () => {
    const robotsContent = [
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: ClaudeBot",
      "Disallow: /",
    ].join("\n");

    const context = makeContext([
      makePage("http://example.com/robots.txt", robotsContent),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(2);
    expect(results[0].metadata).toEqual({ agent: "GPTBot" });
    expect(results[1].metadata).toEqual({ agent: "ClaudeBot" });
  });

  it("ignores partial path blocks (Disallow: /api)", async () => {
    const robotsContent = [
      "User-agent: GPTBot",
      "Disallow: /api",
    ].join("\n");

    const context = makeContext([
      makePage("http://example.com/robots.txt", robotsContent),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(0);
  });

  it("handles case-insensitive agent matching", async () => {
    const robotsContent = [
      "user-agent: gptbot",
      "Disallow: /",
    ].join("\n");

    const context = makeContext([
      makePage("http://example.com/robots.txt", robotsContent),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('blocks AI agent "GPTBot"');
    expect(results[0].metadata).toEqual({ agent: "GPTBot" });
  });

  it("ignores non-AI agent blocks", async () => {
    const robotsContent = [
      "User-agent: SomeRandomBot",
      "Disallow: /",
    ].join("\n");

    const context = makeContext([
      makePage("http://example.com/robots.txt", robotsContent),
    ]);
    const results = await rule.check(context);
    expect(results).toHaveLength(0);
  });
});
