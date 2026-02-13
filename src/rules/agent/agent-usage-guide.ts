import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const AGENT_KEYWORDS = [
  "ai agent",
  "llm",
  "large language model",
  "machine-readable",
  "api access",
  "programmatic access",
  "bot policy",
  "automation",
  "mcp",
  "model context protocol",
];

const rule: AgentLintRule = {
  id: "agent/agent-usage-guide",
  category: "agent",
  severity: "warn",
  description:
    "Site should include guidance or documentation for AI agent consumers",
  remediation:
    "Add a page or section describing how AI agents and LLMs can interact with your site. Include information about API access, bot policies, and machine-readable endpoints.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    const hasAgentGuidance = context.pages.some((page) => {
      const text = page.textContent.toLowerCase();
      return AGENT_KEYWORDS.some((keyword) => text.includes(keyword));
    });

    if (!hasAgentGuidance) {
      results.push({
        ruleId: rule.id,
        severity: rule.severity,
        message:
          "No pages mention AI/agent-related keywords. Consider adding agent usage guidance.",
        url: context.targetUrl,
        remediation: rule.remediation,
      });
    }

    return results;
  },
};

export default rule;
