import { describe, it, expect } from "vitest";
import rule from "../../../src/rules/structure/lang-attribute.js";
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

describe("structure/lang-attribute", () => {
  it("passes when html has lang attribute", async () => {
    const page = makePage(
      "http://example.com",
      '<html lang="en"><body>Content</body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("fails when html has no lang attribute", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body>Content</body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });

  it("fails when lang attribute is empty", async () => {
    const page = makePage(
      "http://example.com",
      '<html lang=""><body>Content</body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });

  it("fails when lang attribute is whitespace only", async () => {
    const page = makePage(
      "http://example.com",
      '<html lang="   "><body>Content</body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("info");
  });

  it("accepts any valid lang value", async () => {
    const page = makePage(
      "http://example.com",
      '<html lang="fr"><body>Contenu</body></html>'
    );
    const results = await rule.check(makeContext([page]));
    expect(results).toHaveLength(0);
  });

  it("reports per page", async () => {
    const pageWith = makePage(
      "http://example.com",
      '<html lang="en"><body>Content</body></html>'
    );
    const pageWithout = makePage(
      "http://example.com/about",
      "<html><body>About</body></html>"
    );
    const results = await rule.check(makeContext([pageWith, pageWithout]));
    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("http://example.com/about");
  });

  it("checks rule metadata", async () => {
    const page = makePage(
      "http://example.com",
      "<html><body>Content</body></html>"
    );
    const results = await rule.check(makeContext([page]));
    expect(results[0].ruleId).toBe("structure/lang-attribute");
    expect(results[0].severity).toBe("info");
  });
});
