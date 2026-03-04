import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/transport/content-type-valid.js";
import type {
  CrawledPage,
  SiteContext,
  AgentLintConfig,
} from "../../../src/types.js";
import { DEFAULT_CONFIG } from "../../../src/types.js";

function makePage(
  url: string,
  headers?: Record<string, string>
): CrawledPage {
  return {
    url,
    status: 200,
    headers: headers ?? { "content-type": "text/html; charset=utf-8" },
    html: "<html><body>Hello</body></html>",
    textContent: "Hello",
    links: [],
    sizeBytes: 100,
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

describe("transport/content-type-valid", () => {
  it("passes when valid content-type is present", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", {
        "content-type": "text/html; charset=utf-8",
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("warns when content-type header is missing", async () => {
    const ctx = makeContext([makePage("http://example.com/", {})]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("transport/content-type-valid");
    expect(results[0].severity).toBe("warn");
    expect(results[0].message).toBe("Missing or invalid content-type header");
    expect(results[0].url).toBe("http://example.com/");
  });

  it("warns when content-type header is empty string", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", { "content-type": "" }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe("Missing or invalid content-type header");
  });

  it("warns when content-type is application/octet-stream", async () => {
    const ctx = makeContext([
      makePage("http://example.com/", {
        "content-type": "application/octet-stream",
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe(
      "Content-type is application/octet-stream, expected text/html or similar"
    );
    expect(results[0].url).toBe("http://example.com/");
  });

  it("passes for various valid content types", async () => {
    const validTypes = ["text/html", "text/plain", "application/json"];

    for (const ct of validTypes) {
      const ctx = makeContext([
        makePage("http://example.com/", { "content-type": ct }),
      ]);
      const results = await rule.check(ctx);
      expect(results).toHaveLength(0);
    }
  });

  it("handles multiple pages with mix of valid and invalid", async () => {
    const ctx = makeContext([
      makePage("http://example.com/good", {
        "content-type": "text/html; charset=utf-8",
      }),
      makePage("http://example.com/missing", {}),
      makePage("http://example.com/octet", {
        "content-type": "application/octet-stream",
      }),
      makePage("http://example.com/also-good", {
        "content-type": "application/json",
      }),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe("http://example.com/missing");
    expect(results[1].url).toBe("http://example.com/octet");
  });
});
