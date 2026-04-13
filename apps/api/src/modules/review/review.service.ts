import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { parsePatch } from "diff";
import type { ReviewIssue, ReviewRequest, ReviewResponse, ReviewSeverity } from "@ai-review/types";
import { redis } from "../../lib/redis.js";
import { createReviewCompletion, createReviewCompletionStream } from "../../lib/openai.js";
import { runAstRules } from "../../analysis/ast-rules.js";

type ReviewOptions = {
  source?: string;
  logger?: FastifyBaseLogger;
  onChunk?: (chunk: string) => void;
};

const PARSE_FALLBACK: ReviewIssue[] = [
  {
    issue: "Failed to parse model response",
    severity: "low",
    suggestion: "Try the review again.",
    line: null,
    source: "llm"
  }
];

function normalizeSeverity(value: unknown): ReviewSeverity {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "low";
}

function parseIssuesFromModel(raw: string): ReviewIssue[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const asArray = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { issues?: unknown })?.issues)
        ? ((parsed as { issues: unknown[] }).issues ?? [])
        : null;

    if (!asArray) {
      return PARSE_FALLBACK;
    }

    return asArray.map((item) => {
      const row = item as {
        issue?: unknown;
        severity?: unknown;
        suggestion?: unknown;
        line?: unknown;
      };

      return {
        issue: typeof row.issue === "string" ? row.issue : "Unspecified issue",
        severity: normalizeSeverity(row.severity),
        suggestion: typeof row.suggestion === "string" ? row.suggestion : "Provide a concrete fix.",
        line: typeof row.line === "number" ? row.line : null,
        source: "llm"
      };
    });
  } catch {
    return PARSE_FALLBACK;
  }
}

function dedupeIssues(issues: ReviewIssue[]): ReviewIssue[] {
  const seen = new Set<string>();
  const merged: ReviewIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.line ?? 0}:${issue.issue}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(issue);
    }
  }

  return merged;
}

function extractAddedLinesWithContext(rawDiff: string): string {
  const files = parsePatch(rawDiff);
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

  if (slices.length === 0) {
    return rawDiff;
  }

  return slices.join("\n\n");
}

function isLikelyDiff(content: string): boolean {
  return content.includes("diff --git") || content.includes("@@") || content.includes("\n+");
}

function buildCacheKey(code: string, context?: string): string {
  return `review:${createHash("sha256").update(`${code}${context ?? ""}`).digest("hex")}`;
}

function computeRisk(issues: ReviewIssue[]): { risk: number; verdict: ReviewResponse["verdict"] } {
  const riskScore =
    issues.filter((issue) => issue.severity === "high").length * 3 +
    issues.filter((issue) => issue.severity === "medium").length * 2 +
    issues.filter((issue) => issue.severity === "low").length * 1;

  const verdict = riskScore >= 6 ? "Needs changes" : riskScore >= 3 ? "Review suggested" : "Looks good";

  return {
    risk: riskScore,
    verdict
  };
}

async function performReview(request: ReviewRequest, options: ReviewOptions): Promise<ReviewResponse> {
  const { logger, source = "http", onChunk } = options;
  logger?.info({ event: "review_start", source });

  const cacheKey = buildCacheKey(request.code, request.context);
  if (redis) {
    const cachedValue = await redis.get(cacheKey);
    if (cachedValue) {
      return JSON.parse(cachedValue) as ReviewResponse;
    }
  }

  const reviewInput = isLikelyDiff(request.code) ? extractAddedLinesWithContext(request.code) : request.code;
  const llmStart = Date.now();

  try {
    const rawModelResponse = onChunk
      ? await createReviewCompletionStream({ ...request, code: reviewInput }, onChunk)
      : await createReviewCompletion({ ...request, code: reviewInput });

    logger?.info({ event: "llm_done", source, latencyMs: Date.now() - llmStart });

    const llmIssues = parseIssuesFromModel(rawModelResponse);
    const astIssues = runAstRules(request.code, request.sourcePath);
    const issues = dedupeIssues([...astIssues, ...llmIssues]);
    const risk = computeRisk(issues);

    const response: ReviewResponse = {
      risk: risk.risk,
      verdict: risk.verdict,
      issues
    };

    if (redis) {
      await redis.set(cacheKey, JSON.stringify(response), "EX", 3600);
    }

    return response;
  } catch (error) {
    logger?.error({
      event: "review_error",
      source,
      error: error instanceof Error ? error.message : "Unknown review error"
    });

    throw error;
  }
}

export async function reviewCode(request: ReviewRequest, options: ReviewOptions = {}): Promise<ReviewResponse> {
  return performReview(request, options);
}

export async function reviewCodeWithStream(
  request: ReviewRequest,
  onChunk: (chunk: string) => void,
  options: Omit<ReviewOptions, "onChunk"> = {}
): Promise<ReviewResponse> {
  return performReview(request, {
    ...options,
    onChunk
  });
}