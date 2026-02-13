import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+\S/m, // headings
  /^\s*[-*+]\s+\S/m, // unordered list
  /^\s*\d+\.\s+\S/m, // ordered list
  /\[.+?\]\(.+?\)/, // links
  /```[\s\S]*?```/, // code fences
  /^\s*>\s+\S/m, // blockquotes
];

const HTML_INDICATORS = [/<!doctype\s+html/i, /<html[\s>]/i, /<head[\s>]/i];

function looksLikeMarkdown(body: string): boolean {
  // Reject if it's clearly HTML
  for (const pattern of HTML_INDICATORS) {
    if (pattern.test(body)) return false;
  }

  // Accept if at least one markdown pattern matches
  for (const pattern of MARKDOWN_PATTERNS) {
    if (pattern.test(body)) return true;
  }

  return false;
}

const rule: AgentLintRule = {
  id: "transport/accept-markdown",
  category: "transport",
  severity: "error",
  description:
    "Site should return markdown content when Accept: text/markdown header is sent",
  remediation:
    "Configure your server to return markdown when it receives `Accept: text/markdown`. Use content negotiation middleware or a reverse proxy rule.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const page of context.pages) {
      const alt = page.alternateRepresentations.get("text/markdown");

      if (!alt) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: "No markdown alternate representation was fetched",
          url: page.url,
        });
        continue;
      }

      if (alt.status < 200 || alt.status >= 300) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Markdown request returned HTTP ${alt.status}`,
          url: page.url,
        });
        continue;
      }

      // Check if the response body looks like HTML instead of markdown
      if (!looksLikeMarkdown(alt.body)) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message:
            "Response to Accept: text/markdown does not contain recognizable markdown content",
          url: page.url,
        });
        continue;
      }
    }

    return results;
  },
};

export default rule;
