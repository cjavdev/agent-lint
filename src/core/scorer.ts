import type { RuleResult, ScoreResult } from "../types.js";

const PENALTY: Record<string, number> = {
  error: 10,
  warn: 4,
  info: 1,
};

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function computeScore(results: RuleResult[]): ScoreResult {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let penalty = 0;

  for (const r of results) {
    switch (r.severity) {
      case "error":
        errors++;
        break;
      case "warn":
        warnings++;
        break;
      case "info":
        infos++;
        break;
    }
    penalty += PENALTY[r.severity] ?? 0;
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    grade: letterGrade(score),
    errors,
    warnings,
    infos,
  };
}
