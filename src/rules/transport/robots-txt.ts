import type { AgentLintRule, RuleResult, SiteContext } from "../../types.js";

const AI_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
  "ChatGPT-User",
  "Bytespider",
  "cohere-ai",
];

const rule: AgentLintRule = {
  id: "transport/robots-txt",
  category: "transport",
  severity: "warn",
  description: "Site should have a robots.txt; AI-targeted blocks are flagged",
  remediation:
    "Add a `/robots.txt` file. Review any `Disallow` directives that may block AI crawlers like GPTBot or ClaudeBot.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    let origin: string;
    try {
      const parsed = new URL(context.targetUrl);
      origin = parsed.origin;
    } catch {
      return results;
    }

    const robotsPage = context.pages.find((page) => {
      try {
        const parsed = new URL(page.url);
        return parsed.pathname === "/robots.txt";
      } catch {
        return false;
      }
    });

    if (!robotsPage) {
      results.push({
        ruleId: rule.id,
        severity: "warn",
        message: "No /robots.txt found at the site root",
        url: origin + "/robots.txt",
      });
      return results;
    }

    // Parse robots.txt line by line
    const lines = robotsPage.textContent.split("\n").map((l) => l.trim());
    let currentAgent = "";

    for (const line of lines) {
      // Skip comments and empty lines
      if (line === "" || line.startsWith("#")) continue;

      const lowerLine = line.toLowerCase();

      if (lowerLine.startsWith("user-agent:")) {
        currentAgent = line.substring("user-agent:".length).trim();
        continue;
      }

      if (lowerLine.startsWith("disallow:")) {
        const path = line.substring("disallow:".length).trim();
        // Only flag full-site blocks (Disallow: / exactly)
        if (path !== "/") continue;

        // Check if current agent is wildcard
        if (currentAgent === "*") {
          results.push({
            ruleId: rule.id,
            severity: "info",
            message: "robots.txt blocks all user agents from the entire site",
            url: origin + "/robots.txt",
            metadata: { agent: "*" },
          });
          continue;
        }

        // Check if current agent is a known AI agent (case-insensitive)
        const matchedAgent = AI_AGENTS.find(
          (a) => a.toLowerCase() === currentAgent.toLowerCase()
        );
        if (matchedAgent) {
          results.push({
            ruleId: rule.id,
            severity: "info",
            message: `robots.txt blocks AI agent "${matchedAgent}" from the entire site`,
            url: origin + "/robots.txt",
            metadata: { agent: matchedAgent },
          });
        }
      }
    }

    return results;
  },
};

export default rule;
