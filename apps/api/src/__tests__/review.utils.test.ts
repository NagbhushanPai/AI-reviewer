import { describe, expect, it } from "vitest";
import {
  computeRisk,
  dedupeAndSortIssues,
  extractAddedLinesWithContext,
  isLikelyDiff,
  PARSE_FALLBACK,
  parseIssuesFromModel
} from "../modules/review/review.utils.js";
import type { ReviewIssue } from "@ai-review/types";

function issue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    issue: "Test issue",
    severity: "low",
    suggestion: "Fix it.",
    line: null,
    source: "llm",
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// computeRisk
// ---------------------------------------------------------------------------
describe("computeRisk", () => {
  it("returns risk 0 and Looks good for empty issues", () => {
    expect(computeRisk([])).toEqual({ risk: 0, verdict: "Looks good" });
  });

  it("calculates risk score: high=3, medium=2, low=1", () => {
    const issues = [issue({ severity: "high" }), issue({ severity: "medium" }), issue({ severity: "low" })];
    expect(computeRisk(issues).risk).toBe(6);
  });

  it("returns Needs changes when risk >= 6", () => {
    const issues = [issue({ severity: "high" }), issue({ severity: "high" })];
    expect(computeRisk(issues).verdict).toBe("Needs changes");
  });

  it("returns Review suggested when risk is 3–5", () => {
    const issues = [issue({ severity: "medium" }), issue({ severity: "low" })];
    // risk = 2 + 1 = 3
    expect(computeRisk(issues).verdict).toBe("Review suggested");
  });

  it("returns Looks good when risk is 1–2", () => {
    expect(computeRisk([issue({ severity: "low" })]).verdict).toBe("Looks good");
  });
});

// ---------------------------------------------------------------------------
// parseIssuesFromModel
// ---------------------------------------------------------------------------
describe("parseIssuesFromModel", () => {
  it("parses a valid JSON array", () => {
    const raw = JSON.stringify([
      { issue: "No error handling", severity: "high", suggestion: "Add try/catch", line: 10 }
    ]);
    const result = parseIssuesFromModel(raw);
    expect(result).toHaveLength(1);
    expect(result[0].issue).toBe("No error handling");
    expect(result[0].severity).toBe("high");
    expect(result[0].line).toBe(10);
    expect(result[0].source).toBe("llm");
  });

  it("parses a wrapped { issues: [...] } response", () => {
    const raw = JSON.stringify({
      issues: [{ issue: "Unused var", severity: "low", suggestion: "Remove it", line: null }]
    });
    const result = parseIssuesFromModel(raw);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("low");
  });

  it("strips markdown code fences", () => {
    const raw = "```json\n[{\"issue\":\"X\",\"severity\":\"medium\",\"suggestion\":\"Y\",\"line\":1}]\n```";
    const result = parseIssuesFromModel(raw);
    expect(result).toHaveLength(1);
    expect(result[0].issue).toBe("X");
  });

  it("returns PARSE_FALLBACK for non-JSON string", () => {
    expect(parseIssuesFromModel("not json")).toEqual(PARSE_FALLBACK);
  });

  it("returns PARSE_FALLBACK when top-level is neither array nor {issues}", () => {
    expect(parseIssuesFromModel(JSON.stringify({ foo: "bar" }))).toEqual(PARSE_FALLBACK);
  });

  it("returns empty array for empty string", () => {
    expect(parseIssuesFromModel("")).toEqual([]);
  });

  it("returns empty array for '[]'", () => {
    expect(parseIssuesFromModel("[]")).toEqual([]);
  });

  it("normalises unknown severity to low", () => {
    const raw = JSON.stringify([{ issue: "X", severity: "critical", suggestion: "Y", line: null }]);
    expect(parseIssuesFromModel(raw)[0].severity).toBe("low");
  });

  it("uses fallback text for missing issue/suggestion fields", () => {
    const raw = JSON.stringify([{ severity: "medium" }]);
    const result = parseIssuesFromModel(raw);
    expect(result[0].issue).toBe("Unspecified issue");
    expect(result[0].suggestion).toBe("Provide a concrete fix.");
  });

  it("rejects non-positive or fractional line numbers", () => {
    const raw = JSON.stringify([{ issue: "X", severity: "low", suggestion: "Y", line: -5 }]);
    expect(parseIssuesFromModel(raw)[0].line).toBeNull();
    const raw2 = JSON.stringify([{ issue: "X", severity: "low", suggestion: "Y", line: 1.5 }]);
    expect(parseIssuesFromModel(raw2)[0].line).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dedupeAndSortIssues
// ---------------------------------------------------------------------------
describe("dedupeAndSortIssues", () => {
  it("removes duplicate issues (same line + text)", () => {
    const a = issue({ issue: "Foo", line: 1, severity: "low" });
    const result = dedupeAndSortIssues([a, { ...a }]);
    expect(result).toHaveLength(1);
  });

  it("sorts high → medium → low", () => {
    const low = issue({ severity: "low", issue: "low" });
    const high = issue({ severity: "high", issue: "high" });
    const med = issue({ severity: "medium", issue: "med" });
    const result = dedupeAndSortIssues([low, high, med]);
    expect(result.map((i) => i.severity)).toEqual(["high", "medium", "low"]);
  });

  it("within the same severity, sorts by line ascending (nulls last)", () => {
    const a = issue({ severity: "high", issue: "a", line: 5 });
    const b = issue({ severity: "high", issue: "b", line: 1 });
    const c = issue({ severity: "high", issue: "c", line: null });
    const result = dedupeAndSortIssues([a, c, b]);
    expect(result.map((i) => i.line)).toEqual([1, 5, null]);
  });
});

// ---------------------------------------------------------------------------
// isLikelyDiff
// ---------------------------------------------------------------------------
describe("isLikelyDiff", () => {
  it("returns true for unified diff headers", () => {
    expect(isLikelyDiff("diff --git a/foo b/foo\n")).toBe(true);
  });

  it("returns true for @@ hunk headers", () => {
    expect(isLikelyDiff("@@ -1,3 +1,4 @@\n")).toBe(true);
  });

  it("returns true for newline-prefixed + lines", () => {
    expect(isLikelyDiff("context\n+new line")).toBe(true);
  });

  it("returns false for plain source code", () => {
    expect(isLikelyDiff("const x = 1;\nconst y = 2;")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractAddedLinesWithContext
// ---------------------------------------------------------------------------
describe("extractAddedLinesWithContext", () => {
  const SIMPLE_DIFF = `diff --git a/foo.ts b/foo.ts
index 0000000..1111111 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
 const d = 4;
`;

  it("extracts added lines with surrounding context", () => {
    const result = extractAddedLinesWithContext(SIMPLE_DIFF);
    expect(result).toContain("+const b = 2;");
    expect(result).toContain("File: b/foo.ts");
  });

  it("returns the raw diff unchanged when no added lines are found", () => {
    // Valid deletion-only diff: old file has 2 lines, new file has 1 line (one deleted).
    const noAdded = [
      "diff --git a/foo.ts b/foo.ts",
      "index abc..def 100644",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1,2 +1,1 @@",
      " const a = 1;",
      "-const b = 2;"
    ].join("\n");
    const result = extractAddedLinesWithContext(noAdded);
    expect(result).toBe(noAdded);
  });

  it("returns the raw string unchanged when the diff is malformed", () => {
    const malformed = "this is not a diff at all";
    const result = extractAddedLinesWithContext(malformed);
    expect(result).toBe(malformed);
  });
});
