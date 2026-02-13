import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "discoverability/structured-data",
  category: "discoverability",
  severity: "info",
  description:
    "Site should include JSON-LD structured data to help AI agents understand content",
  remediation:
    'Add `<script type="application/ld+json">` blocks with Schema.org markup to key pages. This helps AI agents understand page content and relationships.',

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    let origin: string;
    try {
      const parsed = new URL(context.targetUrl);
      origin = parsed.origin;
    } catch {
      return results;
    }

    const hasJsonLd = context.pages.some((page) => {
      const $ = cheerio.load(page.html);
      return $('script[type="application/ld+json"]').length > 0;
    });

    if (!hasJsonLd) {
      results.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: "No JSON-LD structured data found on any page",
        url: origin,
      });
    }

    return results;
  },
};

export default rule;
