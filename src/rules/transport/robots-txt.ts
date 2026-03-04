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

function parseRobotsTxt(text: string, robotsUrl: string, ruleId: string): RuleResult[] {
  const results: RuleResult[] = [];
  const lines = text.split("\n").map((l) => l.trim());
  let currentAgent = "";

  for (const line of lines) {
    if (line === "" || line.startsWith("#")) continue;

    const lowerLine = line.toLowerCase();

    if (lowerLine.startsWith("user-agent:")) {
      currentAgent = line.substring("user-agent:".length).trim();
      continue;
    }

    if (lowerLine.startsWith("disallow:")) {
      const path = line.substring("disallow:".length).trim();
      if (path !== "/") continue;

      if (currentAgent === "*") {
        results.push({
          ruleId,
          severity: "info",
          message: "robots.txt blocks all user agents from the entire site",
          url: robotsUrl,
          metadata: { agent: "*" },
        });
        continue;
      }

      const matchedAgent = AI_AGENTS.find(
        (a) => a.toLowerCase() === currentAgent.toLowerCase()
      );
      if (matchedAgent) {
        results.push({
          ruleId,
          severity: "info",
          message: `robots.txt blocks AI agent "${matchedAgent}" from the entire site`,
          url: robotsUrl,
          metadata: { agent: matchedAgent },
        });
      }
    }
  }

  return results;
}

const rule: AgentLintRule = {
  id: "transport/robots-txt",
  category: "transport",
  severity: "warn",
  description: "Site should have a robots.txt; AI-targeted blocks are flagged",
  remediation:
    "Add a `/robots.txt` file. Review any `Disallow` directives that may block AI crawlers like GPTBot or ClaudeBot.",

  async check(context: SiteContext): Promise<RuleResult[]> {
    let origin: string;
    try {
      origin = new URL(context.targetUrl).origin;
    } catch {
      return [];
    }

    const robotsUrl = origin + "/robots.txt";

    // Fast path: already in crawled pages
    const robotsPage = context.pages.find((page) => {
      try {
        return new URL(page.url).pathname === "/robots.txt";
      } catch {
        return false;
      }
    });

    let robotsText: string | null = robotsPage?.textContent ?? null;

    // Direct fetch fallback
    if (robotsText === null) {
      try {
        const res = await fetch(robotsUrl, {
          headers: { "User-Agent": "AgentLint/0.1" },
          redirect: "follow",
        });
        if (res.ok) {
          robotsText = await res.text();
        }
      } catch {
        // Network error, treat as not found
      }
    }

    if (robotsText === null) {
      return [{
        ruleId: rule.id,
        severity: "warn",
        message: "No /robots.txt found at the site root",
        url: robotsUrl,
      }];
    }

    return parseRobotsTxt(robotsText, robotsUrl, rule.id);
  },
};

export default rule;
