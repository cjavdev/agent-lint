import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "structure/meta-description",
  category: "structure",
  severity: "info",
  description:
    "Pages should have a meta description to help AI agents understand page content",
  remediation:
    'Add a `<meta name="description" content="...">` tag in the `<head>` with a concise summary of the page content.',

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      const $ = cheerio.load(page.html);

      // Find meta elements with name="description" (case-insensitive)
      let hasDescription = false;
      $("meta[name]").each((_, el) => {
        const name = $(el).attr("name");
        if (name && name.toLowerCase() === "description") {
          const content = $(el).attr("content");
          if (content && content.trim() !== "") {
            hasDescription = true;
          }
        }
      });

      if (!hasDescription) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: "Page is missing a meta description",
          url: page.url,
        });
      }
    }

    return results;
  },
};

export default rule;
