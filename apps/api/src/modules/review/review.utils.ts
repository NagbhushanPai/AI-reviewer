import { parsePatch } from "diff";
import type { ReviewIssue, ReviewResponse, ReviewSeverity } from "@ai-review/types";

export const PARSE_FALLBACK: ReviewIssue[] = [
  {
    issue: "Failed to parse model response",
    severity: "low",
    suggestion: "Try the review again.",
    line: null,
    source: "llm"
  }
];

const SEVERITY_ORDER: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1
};

function normalizeSeverity(value: unknown): ReviewSeverity {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "low";
}

export function parseIssuesFromModel(raw: string): ReviewIssue[] {
  const trimmed = raw.trim();

  if (!trimmed || trimmed === "[]") {
    return [];
  }

  // Strip accidental markdown code fences (e.g. ```json ... ```)
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

  try {
    const parsed = JSON.parse(stripped) as unknown;

    const asArray = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { issues?: unknown })?.issues)
        ? ((parsed as { issues: unknown[] }).issues ?? [])
        : null;

    if (!asArray) {
      return PARSE_FALLBACK;
    }

    return asArray
      .filter((item) => item !== null && typeof item === "object")
      .map((item) => {
        const row = item as {
          issue?: unknown;
          severity?: unknown;
          suggestion?: unknown;
          line?: unknown;
        };

        return {
          issue: typeof row.issue === "string" && row.issue.trim() ? row.issue.trim() : "Unspecified issue",
          severity: normalizeSeverity(row.severity),
          suggestion: typeof row.suggestion === "string" && row.suggestion.trim()
            ? row.suggestion.trim()
            : "Provide a concrete fix.",
          line: typeof row.line === "number" && Number.isInteger(row.line) && row.line > 0
            ? row.line
            : null,
          source: "llm" as const
        };
      });
  } catch {
    return PARSE_FALLBACK;
  }
}

export function dedupeAndSortIssues(issues: ReviewIssue[]): ReviewIssue[] {
  const seen = new Set<string>();
  const merged: ReviewIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.line ?? 0}:${issue.issue}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(issue);
    }
  }

  return merged.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (severityDiff !== 0) return severityDiff;

    if (a.line === null && b.line === null) return 0;
    if (a.line === null) return 1;
    if (b.line === null) return -1;
    return a.line - b.line;
  });
}

export function computeRisk(issues: ReviewIssue[]): { risk: number; verdict: ReviewResponse["verdict"] } {
  const riskScore =
    issues.filter((i) => i.severity === "high").length * 3 +
    issues.filter((i) => i.severity === "medium").length * 2 +
    issues.filter((i) => i.severity === "low").length * 1;

  const verdict: ReviewResponse["verdict"] =
    riskScore >= 6 ? "Needs changes" : riskScore >= 3 ? "Review suggested" : "Looks good";

  return { risk: riskScore, verdict };
}

export function isLikelyDiff(content: string): boolean {
  return content.includes("diff --git") || content.includes("@@") || content.includes("\n+");
}

export function extractAddedLinesWithContext(rawDiff: string): string {
  let files: ReturnType<typeof parsePatch>;

  try {
    files = parsePatch(rawDiff);
  } catch {
    // If the diff is malformed, return it as-is so the LLM can still analyse it.
    return rawDiff;
  }

  const slices: string[] = [];

  for (const file of files) {
    const filename = file.newFileName ?? file.oldFileName ?? "unknown";

    for (const hunk of file.hunks ?? []) {
      for (let index = 0; index < hunk.lines.length; index += 1) {
        const line = hunk.lines[index];
        if (!line.startsWith("+") || line.startsWith("+++")) {
          continue;
        }

        const start = Math.max(0, index - 2);
        const end = Math.min(hunk.lines.length - 1, index + 2);
        const snippet = hunk.lines.slice(start, end + 1).join("\n");
        slices.push(`File: ${filename}\n${snippet}`);
      }
    }
  }

  return slices.length === 0 ? rawDiff : slices.join("\n\n");
}
