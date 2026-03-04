import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "discoverability/rel-alternate-markdown",
  category: "discoverability",
  severity: "info",
  description:
    "Pages should include a <link rel=\"alternate\" type=\"text/markdown\"> to advertise markdown versions",
  remediation:
    "Add `<link rel=\"alternate\" type=\"text/markdown\" href=\"/path/to/page.md\">` in your HTML `<head>` to advertise a markdown version of each page.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      // Skip non-HTML pages
      const contentType = page.headers["content-type"] ?? "";
      if (!contentType.includes("text/html")) continue;

      const hasMarkdownAlternate = page.relAlternateLinks.some(
        (link) => link.type === "text/markdown"
      );

      if (!hasMarkdownAlternate) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message:
            "Page does not include a <link rel=\"alternate\" type=\"text/markdown\"> in the HTML head",
          url: page.url,
        });
      }
    }

    return results;
  },
};

export default rule;
