import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AgentLintConfig,
  AgentLintRule,
  CrawledPage,
  RuleResult,
  SiteContext,
} from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";
import { isPathIgnored } from "./path-matcher.js";

export function buildSiteContext(
  targetUrl: string,
  pages: CrawledPage[],
  config: Partial<AgentLintConfig> = {}
): SiteContext {
  return {
    targetUrl,
    pages,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

export async function discoverRules(
  rulesDir?: string
): Promise<AgentLintRule[]> {
  const dir =
    rulesDir ??
    join(dirname(fileURLToPath(import.meta.url)), "..", "rules");

  const rules: AgentLintRule[] = [];
  let categories: string[];

  try {
    categories = await readdir(dir);
  } catch {
    return rules;
  }

  for (const category of categories) {
    const categoryDir = join(dir, category);
    let files: string[];
    try {
      files = await readdir(categoryDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (
        !file.endsWith(".ts") &&
        !file.endsWith(".js") ||
        file.endsWith(".test.ts") ||
        file.endsWith(".d.ts")
      ) {
        continue;
      }

      try {
        const mod = await import(join(categoryDir, file));
        const rule = mod.default as AgentLintRule;
        if (rule && rule.id && typeof rule.check === "function") {
          rules.push(rule);
        }
      } catch {
        // Skip files that fail to import
      }
    }
  }

  return rules;
}

export async function analyze(
  context: SiteContext,
  rules: AgentLintRule[]
): Promise<RuleResult[]> {
  const results: RuleResult[] = [];

  for (const rule of rules) {
    const ruleConfig = context.config.rules[rule.id];

    // Skip disabled rules
    if (ruleConfig?.enabled === false) continue;

    const ruleResults = await rule.check(context);

    // Apply severity overrides and copy remediation
    for (const r of ruleResults) {
      if (ruleConfig?.severity) {
        r.severity = ruleConfig.severity;
      }
      if (rule.remediation) {
        r.remediation = rule.remediation;
      }
    }

    // Filter results by path-based ignores
    const globalIgnores = context.config.ignorePatterns ?? [];
    const ruleIgnores = ruleConfig?.ignorePaths ?? [];
    const filtered = ruleResults.filter((r) => {
      if (!r.url) return true; // site-wide results are never path-filtered
      if (isPathIgnored(r.url, globalIgnores)) return false;
      if (isPathIgnored(r.url, ruleIgnores)) return false;
      return true;
    });

    results.push(...filtered);
  }

  return results;
}
