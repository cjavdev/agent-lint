import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import rule from "../../../src/rules/discoverability/llms-txt.js";
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
    headers: { "content-type": "text/plain" },
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

describe("discoverability/llms-txt", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("passes when /llms.txt exists in crawled pages (no fetch needed)", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/llms.txt"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes when direct fetch returns 200", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com/llms.txt",
      expect.objectContaining({ method: "HEAD" })
    );
  });

  it("fails when direct fetch returns 404", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("discoverability/llms-txt");
    expect(results[0].severity).toBe("error");
    expect(results[0].url).toBe("https://example.com/llms.txt");
  });

  it("fails gracefully on network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const ctx = makeContext([makePage("https://example.com/")]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].message).toContain("/llms.txt");
  });

  it("works with targetUrl that has a path", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const ctx = makeContext(
      [makePage("https://example.com/docs")],
      "https://example.com/docs"
    );
    const results = await rule.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://example.com/llms.txt");
  });

  it("returns no violation when /llms.txt is among many pages", async () => {
    const ctx = makeContext([
      makePage("https://example.com/"),
      makePage("https://example.com/about"),
      makePage("https://example.com/llms.txt"),
      makePage("https://example.com/docs"),
    ]);
    const results = await rule.check(ctx);
    expect(results).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
