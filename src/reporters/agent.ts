import type { ReportData, RuleResult } from "../types.js";

const SEVERITY_ICON: Record<string, string> = {
  error: "\u2716",
  warn: "\u26A0",
  info: "\u2139",
};

const SEVERITY_LABEL: Record<string, string> = {
  error: "Errors (fix these first)",
  warn: "Warnings",
  info: "Info",
};

function groupBySeverity(
  results: RuleResult[]
): Map<string, RuleResult[]> {
  const groups = new Map<string, RuleResult[]>();
  for (const r of results) {
    const list = groups.get(r.severity) ?? [];
    list.push(r);
    groups.set(r.severity, list);
  }
  return groups;
}

export function formatAgentReport(data: ReportData): string {
  const lines: string[] = [];

  // Header
  const { score } = data;
  lines.push(`# AgentLint Report: ${data.targetUrl}`);
  lines.push(
    `Score: ${score.score}/100 (Grade: ${score.grade}) | ${score.errors} error${score.errors !== 1 ? "s" : ""}, ${score.warnings} warning${score.warnings !== 1 ? "s" : ""}, ${score.infos} info | ${data.pageCount} page${data.pageCount !== 1 ? "s" : ""} crawled`
  );
  lines.push("");

  if (data.results.length === 0) {
    lines.push("No violations found. This site is fully agent-friendly!");
    return lines.join("\n");
  }

  // Group by severity, output in order: error, warn, info
  const groups = groupBySeverity(data.results);
  const severities = ["error", "warn", "info"];

  for (const sev of severities) {
    const results = groups.get(sev);
    if (!results || results.length === 0) continue;

    lines.push(`## ${SEVERITY_LABEL[sev]}`);
    lines.push("");

    for (const r of results) {
      const icon = SEVERITY_ICON[r.severity] ?? "?";
      lines.push(`### ${icon} ${r.ruleId}`);
      if (r.url) {
        lines.push(`**Page:** ${r.url}`);
      }
      lines.push(`**Issue:** ${r.message}`);
      if (r.remediation) {
        lines.push(`**Fix:** ${r.remediation}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
