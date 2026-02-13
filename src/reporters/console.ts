import chalk from "chalk";
import type { ReportData } from "../types.js";

const SEVERITY_ICON: Record<string, string> = {
  error: chalk.red("✖"),
  warn: chalk.yellow("⚠"),
  info: chalk.blue("ℹ"),
};

const SEVERITY_COLOR: Record<string, (s: string) => string> = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
};

function gradeColor(grade: string): (s: string) => string {
  switch (grade) {
    case "A":
      return chalk.green;
    case "B":
      return chalk.greenBright;
    case "C":
      return chalk.yellow;
    case "D":
      return chalk.redBright;
    default:
      return chalk.red;
  }
}

export function formatConsoleReport(data: ReportData): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold(`AgentLint Report: ${data.targetUrl}`));
  lines.push(chalk.dim("─".repeat(60)));
  lines.push("");

  if (data.results.length === 0) {
    lines.push(chalk.green("  No violations found!"));
    lines.push("");
  } else {
    for (const r of data.results) {
      const icon = SEVERITY_ICON[r.severity] ?? "?";
      const color = SEVERITY_COLOR[r.severity] ?? ((s: string) => s);
      const ruleTag = chalk.dim(`[${r.ruleId}]`);
      const urlTag = r.url ? chalk.dim(` ${r.url}`) : "";
      lines.push(`  ${icon} ${color(r.message)} ${ruleTag}${urlTag}`);
    }
    lines.push("");
  }

  lines.push(chalk.dim("─".repeat(60)));

  const gc = gradeColor(data.score.grade);
  lines.push(
    `  Score: ${gc(String(data.score.score))} / 100  Grade: ${gc(data.score.grade)}`
  );

  const counts: string[] = [];
  if (data.score.errors > 0)
    counts.push(chalk.red(`${data.score.errors} error${data.score.errors > 1 ? "s" : ""}`));
  if (data.score.warnings > 0)
    counts.push(chalk.yellow(`${data.score.warnings} warning${data.score.warnings > 1 ? "s" : ""}`));
  if (data.score.infos > 0)
    counts.push(chalk.blue(`${data.score.infos} info${data.score.infos > 1 ? "s" : ""}`));

  if (counts.length > 0) {
    lines.push(`  ${counts.join("  ")}`);
  }

  lines.push(
    `  ${chalk.dim(`${data.pageCount} page${data.pageCount !== 1 ? "s" : ""} crawled in ${(data.duration / 1000).toFixed(1)}s`)}`
  );
  lines.push("");

  return lines.join("\n");
}
