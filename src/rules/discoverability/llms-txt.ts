import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "discoverability/llms-txt",
  category: "discoverability",
  severity: "error",
  description: "Site should have an /llms.txt file for AI agent discoverability",
  remediation:
    "Create an `/llms.txt` file at your site root describing your site for AI agents. See https://llmstxt.org for the specification.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    let origin: string;
    try {
      origin = new URL(context.targetUrl).origin;
    } catch {
      return [];
    }

    const targetPath = "/llms.txt";
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
      message: "No /llms.txt file found at the site root",
      url: targetUrl,
    }];
  },
};

export default rule;
