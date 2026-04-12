import { randomUUID } from "node:crypto";
import type { ReviewFinding, ReviewRequest, ReviewResponse } from "@ai-review/types";
import { buildReviewContext } from "../ai/ai.service.js";
import { callReviewModel } from "../../lib/openai.js";
import { readCachedReview, writeCachedReview } from "../../services/review-cache.service.js";

function findLine(code: string, matcher: RegExp): number | undefined {
  const lines = code.split(/\r?\n/);
  const index = lines.findIndex((line) => matcher.test(line));
  return index >= 0 ? index + 1 : undefined;
}

function heuristicReview(code: string): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  if (/\bany\b/.test(code)) {
    findings.push({
      id: randomUUID(),
      message: "Avoid `any` because it removes the safety benefits of TypeScript.",
      severity: "warning",
      line: findLine(code, /\bany\b/),
      suggestion: "Replace it with a narrower type or a generic.",
      source: "heuristic"
    });
  }

  if (/console\.log\(/.test(code)) {
    findings.push({
      id: randomUUID(),
      message: "Console logging should not ship in production paths.",
      severity: "info",
      line: findLine(code, /console\.log\(/),
      suggestion: "Use structured logging behind a logger abstraction.",
      source: "heuristic"
    });
  }

  if (/TODO|FIXME/.test(code)) {
    findings.push({
      id: randomUUID(),
      message: "There is a pending TODO or FIXME in the code.",
      severity: "info",
      line: findLine(code, /TODO|FIXME/),
      suggestion: "Resolve the note or track it as an explicit follow-up task.",
      source: "heuristic"
    });
  }

  if (/eval\(/.test(code)) {
    findings.push({
      id: randomUUID(),
      message: "Avoid `eval` because it is unsafe and hard to reason about.",
      severity: "error",
      line: findLine(code, /eval\(/),
      suggestion: "Replace it with explicit parsing or a safe interpreter.",
      source: "heuristic"
    });
  }

  return findings;
}

function mergeFindings(base: ReviewFinding[], additional: ReviewFinding[]): ReviewFinding[] {
  const seen = new Set<string>();
  const merged: ReviewFinding[] = [];

  for (const finding of [...base, ...additional]) {
    const key = `${finding.line ?? 0}:${finding.message}`;

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(finding);
    }
  }

  return merged;
}

export async function reviewCode(request: ReviewRequest): Promise<ReviewResponse> {
  const cachedReview = await readCachedReview(request.code, request.language, request.context);
  if (cachedReview) {
    return cachedReview;
  }

  const heuristicFindings = heuristicReview(request.code);
  const context = buildReviewContext(request.language, request.repository, request.context);

  let aiReview: ReviewResponse = {
    summary: "AI review unavailable.",
    findings: []
  };

  try {
    aiReview = await callReviewModel({
      ...request,
      context
    });
  } catch {
    aiReview = {
      summary: "AI review failed, so heuristic checks were returned instead.",
      findings: []
    };
  }

  const findings = mergeFindings(heuristicFindings, aiReview.findings);

  const response: ReviewResponse = {
    summary: aiReview.summary || (findings.length > 0 ? "Review completed with actionable feedback." : "No issues found in the first pass."),
    findings
  };

  void writeCachedReview(request.code, request.language, request.context, response);

  return response;
}