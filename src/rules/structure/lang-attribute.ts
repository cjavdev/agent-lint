import * as cheerio from "cheerio";
import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const rule: AgentLintRule = {
  id: "structure/lang-attribute",
  category: "structure",
  severity: "info",
  description:
    "Pages should declare a language via the lang attribute on the <html> element",
  remediation:
    'Add a `lang` attribute to the `<html>` element, e.g. `<html lang="en">`. This helps AI agents determine the content language.',

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      const $ = cheerio.load(page.html);
      const lang = $("html").attr("lang");

      if (!lang || lang.trim() === "") {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: "Page is missing a lang attribute on the <html> element",
          url: page.url,
        });
      }
    }

    return results;
  },
};

export default rule;
