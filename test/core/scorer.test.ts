import { describe, it, expect } from "vitest";
import { computeScore } from "../../src/core/scorer.js";
import type { RuleResult } from "../../src/types.js";

function result(severity: "error" | "warn" | "info"): RuleResult {
  return { ruleId: "test/rule", message: "test", severity };
}

describe("computeScore", () => {
  it("returns perfect score with no violations", () => {
    const s = computeScore([]);
    expect(s.score).toBe(100);
    expect(s.grade).toBe("A");
    expect(s.errors).toBe(0);
    expect(s.warnings).toBe(0);
    expect(s.infos).toBe(0);
  });

  it("subtracts 10 per error", () => {
    const s = computeScore([result("error")]);
    expect(s.score).toBe(90);
    expect(s.grade).toBe("A");
    expect(s.errors).toBe(1);
  });

  it("subtracts 4 per warning", () => {
    const s = computeScore([result("warn")]);
    expect(s.score).toBe(96);
    expect(s.grade).toBe("A");
    expect(s.warnings).toBe(1);
  });

  it("subtracts 1 per info", () => {
    const s = computeScore([result("info")]);
    expect(s.score).toBe(99);
    expect(s.grade).toBe("A");
    expect(s.infos).toBe(1);
  });

  it("handles mixed violations", () => {
    const s = computeScore([
      result("error"),
      result("error"),
      result("warn"),
      result("info"),
    ]);
    // 100 - 10 - 10 - 4 - 1 = 75
    expect(s.score).toBe(75);
    expect(s.grade).toBe("C");
    expect(s.errors).toBe(2);
    expect(s.warnings).toBe(1);
    expect(s.infos).toBe(1);
  });

  it("clamps score to 0 (never negative)", () => {
    const results = Array.from({ length: 20 }, () => result("error"));
    const s = computeScore(results);
    expect(s.score).toBe(0);
    expect(s.grade).toBe("F");
  });

  it("assigns correct grade at boundaries", () => {
    // 90 → A
    expect(computeScore([result("error")]).grade).toBe("A");
    // 89 → B  (100 - 10 - 1 = 89)
    expect(
      computeScore([result("error"), result("info")]).grade
    ).toBe("B");
    // 80 → B  (100 - 10 - 10 = 80)
    expect(
      computeScore([result("error"), result("error")]).grade
    ).toBe("B");
    // 79 → C  (100 - 10 - 10 - 1 = 79)
    expect(
      computeScore([result("error"), result("error"), result("info")]).grade
    ).toBe("C");
    // 60 → D  (100 - 40 = 60)
    expect(
      computeScore(Array.from({ length: 4 }, () => result("error"))).grade
    ).toBe("D");
    // 59 → F  (100 - 40 - 1 = 59)
    expect(
      computeScore([
        ...Array.from({ length: 4 }, () => result("error")),
        result("info"),
      ]).grade
    ).toBe("F");
  });
});
