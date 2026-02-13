import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

const rule: AgentLintRule = {
  id: "structure/anchor-ids",
  category: "structure",
  severity: "warn",
  description:
    "Headings should have anchor IDs to enable deep linking for AI agents",
  remediation:
    'Add `id` attributes to heading elements for deep linking. Example: `<h2 id="section-name">Section Name</h2>`.',

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      const $ = cheerio.load(page.html);
      const headings = $(HEADING_SELECTOR);

      if (headings.length === 0) continue;

      let missing = 0;

      headings.each((_, el) => {
        const $el = $(el);

        // 1. Direct id attribute on the heading
        const directId = $el.attr("id");
        if (directId && directId.trim() !== "") return;

        // 2. Child <a> with name attribute (legacy pattern)
        const childAnchorName = $el.find("a[name]").first().attr("name");
        if (childAnchorName && childAnchorName.trim() !== "") return;

        // 3. Child <a> with id attribute
        const childAnchorId = $el.find("a[id]").first().attr("id");
        if (childAnchorId && childAnchorId.trim() !== "") return;

        missing++;
      });

      if (missing > 0) {
        const total = headings.length;
        const pct = Math.round((missing / total) * 100);
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `${missing} of ${total} headings (${pct}%) lack anchor IDs for deep linking`,
          url: page.url,
          metadata: { missing, total, percentage: pct },
        });
      }
    }

    return results;
  },
};

export default rule;
