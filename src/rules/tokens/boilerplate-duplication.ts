import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const BOILERPLATE_SELECTOR = "nav, header, footer";
const THRESHOLD = 0.3;

function extractBoilerplateText($: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  $(BOILERPLATE_SELECTOR).each((_i, el) => {
    parts.push($(el).text());
  });
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function extractTotalText($: cheerio.CheerioAPI): string {
  return ($("body").text() || $.text()).replace(/\s+/g, " ").trim();
}

const rule: AgentLintRule = {
  id: "tokens/boilerplate-duplication",
  category: "tokens",
  severity: "warn",
  description:
    "Repeated boilerplate (nav/header/footer) should be under 30% of page content",
  remediation:
    "Reduce repeated navigation, header, and footer content. Consider using a condensed nav for AI-facing pages or serving markdown alternatives.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    // Need at least 2 pages to detect duplication patterns
    if (context.pages.length < 2) {
      return results;
    }

    const ratios: { url: string; ratio: number }[] = [];

    for (const page of context.pages) {
      const $ = cheerio.load(page.html);
      const boilerplateText = extractBoilerplateText($);
      const totalText = extractTotalText($);

      // Skip pages with no meaningful content
      if (totalText.length === 0) {
        continue;
      }

      const ratio = boilerplateText.length / totalText.length;
      ratios.push({ url: page.url, ratio });
    }

    if (ratios.length < 2) {
      return results;
    }

    const averageRatio =
      ratios.reduce((sum, r) => sum + r.ratio, 0) / ratios.length;

    // Only emit warnings if the average ratio exceeds the threshold
    if (averageRatio > THRESHOLD) {
      for (const { url, ratio } of ratios) {
        if (ratio > THRESHOLD) {
          const percentage = Math.round(ratio * 100);
          results.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: `Page has ${percentage}% boilerplate content (nav/header/footer). Threshold: 30%`,
            url,
            metadata: {
              boilerplateRatio: ratio,
              percentage,
              averageRatio,
            },
            remediation: rule.remediation,
          });
        }
      }
    }

    return results;
  },
};

export default rule;
