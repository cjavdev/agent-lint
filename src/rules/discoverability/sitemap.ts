import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "discoverability/sitemap",
  category: "discoverability",
  severity: "warn",
  description: "Site should have a /sitemap.xml for crawlability",
  remediation:
    "Add a `/sitemap.xml` file listing all pages. Most CMS platforms and static site generators can generate this automatically.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    let origin: string;
    try {
      origin = new URL(context.targetUrl).origin;
    } catch {
      return [];
    }

    const targetPath = "/sitemap.xml";
    const targetUrl = origin + targetPath;

    // Fast path: already in crawled pages
    const inCrawl = context.pages.some((page) => {
      try { return new URL(page.url).pathname === targetPath; }
      catch { return false; }
    });
    if (inCrawl) return [];

    // Direct fetch
    try {
      const res = await fetch(targetUrl, {
        method: "HEAD",
        headers: { "User-Agent": "AgentLint/0.1" },
        redirect: "follow",
      });
      if (res.ok) return [];
    } catch {
      // Network error — treat as not found
    }

    return [{
      ruleId: rule.id,
      severity: rule.severity,
      message: "No /sitemap.xml found at the site root",
      url: targetUrl,
    }];
  },
};

export default rule;
