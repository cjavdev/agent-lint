import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "agent/mcp-detect",
  category: "agent",
  severity: "info",
  description: "Site could publish an MCP manifest for tool-use capabilities",
  remediation:
    "If your site offers tool-use capabilities, publish an MCP manifest at `/.well-known/mcp.json`.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    let origin: string;
    try {
      const parsed = new URL(context.targetUrl);
      origin = parsed.origin;
    } catch {
      return results;
    }

    const found = context.pages.some((page) => {
      try {
        const parsed = new URL(page.url);
        return parsed.pathname === "/.well-known/mcp.json";
      } catch {
        return false;
      }
    });

    if (!found) {
      results.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: "No MCP manifest found at /.well-known/mcp.json",
        url: origin + "/.well-known/mcp.json",
      });
    }

    return results;
  },
};

export default rule;
