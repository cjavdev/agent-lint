import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "tokens/nav-ratio",
  category: "tokens",
  severity: "info",
  description:
    "Reports pages where navigation elements consume a large share of tokens",
  remediation:
    "Consider reducing navigation content on pages intended for AI consumption. Use condensed nav, skip-links, or serve markdown alternatives without navigation chrome.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      if (!page.textContent || page.textContent.length === 0) {
        continue;
      }

      const totalTokens = Math.ceil(page.textContent.length / 4);

      const $ = cheerio.load(page.html);
      const navText = $("nav").text().trim();
      const navTokens = Math.ceil(navText.length / 4);

      const navRatio = navTokens / totalTokens;

      if (navRatio > 0.2) {
        const pct = (navRatio * 100).toFixed(1);
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Navigation consumes ${pct}% of page tokens (${navTokens} of ${totalTokens})`,
          url: page.url,
          metadata: { navRatio, navTokens, totalTokens },
        });
      }
    }

    return results;
  },
};

export default rule;
