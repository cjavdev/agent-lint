import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const OPENAPI_PATHS = [
  "/openapi.json",
  "/openapi.yaml",
  "/swagger.json",
  "/api-docs",
  "/.well-known/openapi.json",
];

const rule: AgentLintRule = {
  id: "discoverability/openapi-detect",
  category: "discoverability",
  severity: "info",
  description: "Site could publish an OpenAPI specification for API discoverability",
  remediation:
    "If your site has an API, publish an OpenAPI spec at `/openapi.json` or `/.well-known/openapi.json`.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    let origin: string;
    try {
      origin = new URL(context.targetUrl).origin;
    } catch {
      return [];
    }

    // Fast path: already in crawled pages
    const inCrawl = context.pages.some((page) => {
      try { return OPENAPI_PATHS.includes(new URL(page.url).pathname); }
      catch { return false; }
    });
    if (inCrawl) return [];

    // Direct fetch each path, stop on first success
    for (const path of OPENAPI_PATHS) {
      try {
        const res = await fetch(origin + path, {
          method: "HEAD",
          headers: { "User-Agent": "AgentLint/0.1" },
          redirect: "follow",
        });
        if (res.ok) return [];
      } catch {
        // Network error — try next path
      }
    }

    return [{
      ruleId: rule.id,
      severity: rule.severity,
      message: "No OpenAPI specification found at common paths",
      url: origin + "/.well-known/openapi.json",
    }];
  },
};

export default rule;
