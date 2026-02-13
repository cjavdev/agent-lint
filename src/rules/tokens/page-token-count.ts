import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "tokens/page-token-count",
  category: "tokens",
  severity: "warn",
  description:
    "Pages should stay under the token threshold for efficient AI consumption",
  remediation:
    "Reduce page content to stay under the token threshold. Remove boilerplate, excessive navigation, or split into smaller pages.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];
    const threshold = context.config.tokenThreshold;

    for (const page of context.pages) {
      const estimatedTokens = Math.ceil(page.textContent.length / 4);

      if (estimatedTokens > threshold) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Page has ~${estimatedTokens} estimated tokens (threshold: ${threshold})`,
          url: page.url,
          metadata: { estimatedTokens, threshold },
        });
      }
    }

    return results;
  },
};

export default rule;
