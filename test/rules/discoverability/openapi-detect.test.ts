import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import rule from "../../../src/rules/discoverability/openapi-detect.js";
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
    headers: { "content-type": "text/html" },
    html: "",
    textContent: "",
    links: [],
    sizeBytes: 100,
    alternateRepresentations: new Map(),
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

describe("discoverability/openapi-detect", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("passes when /openapi.json exists in crawled pages (no fetch needed)", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/openapi.json"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes when /openapi.yaml exists in crawled pages", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/openapi.yaml"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes when /swagger.json exists in crawled pages", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/swagger.json"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("passes when /.well-known/openapi.json exists in crawled pages", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/.well-known/openapi.json"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("passes when /api-docs exists in crawled pages", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/api-docs"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("passes when direct fetch finds openapi.json (first path)", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/openapi.json",
      expect.objectContaining({ method: "HEAD" })
    );
  });

  it("passes when direct fetch finds a later path", async () => {
    // First two paths return 404, third (swagger.json) returns 200
    fetchSpy
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("fails when all direct fetches return 404", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("discoverability/openapi-detect");
    expect(results[0].severity).toBe("info");
    expect(results[0].url).toBe(
      "https://example.com/.well-known/openapi.json"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(5); // all 5 paths attempted
  });

  it("fails gracefully on network errors for all paths", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("OpenAPI");
  });

  it("severity is info", () => {
    expect(rule.severity).toBe("info");
  });
});
