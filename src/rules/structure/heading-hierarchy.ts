import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

function headingLevel(tagName: string): number {
  return parseInt(tagName.replace("h", ""), 10);
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + "\u2026";
}

const rule: AgentLintRule = {
  id: "structure/heading-hierarchy",
  category: "structure",
  severity: "warn",
  description:
    "Pages should have an H1 element and heading levels should not skip (e.g. h1 to h3)",
  remediation:
    "Ensure each page has exactly one `<h1>` and heading levels don't skip (e.g. don't jump from `<h1>` to `<h3>`).",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      const $ = cheerio.load(page.html);
      const headings = $(HEADING_SELECTOR);

      // Sub-check 1: Missing H1
      if ($("h1").length === 0 && headings.length > 0) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: "Page is missing an <h1> element",
          url: page.url,
        });
      }

      // Sub-check 2: Skipped heading levels
      let lastLevel = 0;

      headings.each((_i, el) => {
        const tagName = $(el).prop("tagName")!.toLowerCase();
        const level = headingLevel(tagName);
        const text = truncate($(el).text(), 80);

        if (level > lastLevel + 1) {
          results.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: `Heading level skipped from h${lastLevel || "none"} to <${tagName}>: "${text}"`,
            url: page.url,
            metadata: { from: lastLevel, to: level, text },
          });
        }

        lastLevel = level;
      });
    }

    return results;
  },
};

export default rule;
