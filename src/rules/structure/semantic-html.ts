import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "structure/semantic-html",
  category: "structure",
  severity: "info",
  description:
    "Pages should use semantic HTML elements (<main>, <article>, <section>) to help AI agents identify content areas",
  remediation:
    "Wrap primary content in `<main>`, use `<article>` for standalone content blocks, and `<section>` for thematic groupings.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      const $ = cheerio.load(page.html);

      const hasMain = $("main").length > 0;
      const hasArticle = $("article").length > 0;
      const hasSection = $("section").length > 0;

      if (!hasMain && !hasArticle && !hasSection) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message:
            "Page lacks semantic HTML landmarks (<main>, <article>, or <section>)",
          url: page.url,
        });
      }
    }

    return results;
  },
};

export default rule;
