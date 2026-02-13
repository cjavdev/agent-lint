import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "transport/content-type-valid",
  category: "transport",
  severity: "warn",
  description: "Responses should have a valid content-type header",
  remediation:
    "Ensure your server sends a valid `Content-Type` header (e.g. `text/html; charset=utf-8`) for all HTML responses.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      const contentType = page.headers["content-type"];

      if (!contentType) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: "Missing or invalid content-type header",
          url: page.url,
        });
        continue;
      }

      if (contentType === "application/octet-stream") {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message:
            "Content-type is application/octet-stream, expected text/html or similar",
          url: page.url,
        });
        continue;
      }
    }

    return results;
  },
};

export default rule;
