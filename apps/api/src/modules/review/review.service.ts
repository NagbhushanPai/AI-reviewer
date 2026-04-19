import type { FastifyBaseLogger } from "fastify";
import type { ReviewRequest, ReviewResponse } from "@ai-review/types";
import { readCachedReview, writeCachedReview } from "../../services/review-cache.service.js";
import { createReviewCompletion, createReviewCompletionStream } from "../../lib/openai.js";
import { runAstRules } from "../../analysis/ast-rules.js";
import {
  parseIssuesFromModel,
  dedupeAndSortIssues,
  computeRisk,
  isLikelyDiff,
  extractAddedLinesWithContext
} from "./review.utils.js";

type ReviewOptions = {
  source?: string;
  logger?: FastifyBaseLogger;
  onChunk?: (chunk: string) => void;
};

async function performReview(request: ReviewRequest, options: ReviewOptions): Promise<ReviewResponse> {
  const { logger, source = "http", onChunk } = options;
  logger?.info({ event: "review_start", source });

  const cached = await readCachedReview(request.code, request.language, request.context);
  if (cached) {
    logger?.info({ event: "review_cache_hit", source });
    return cached;
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
    const issues = dedupeAndSortIssues([...astIssues, ...llmIssues]);
    const { risk, verdict } = computeRisk(issues);

    const response: ReviewResponse = { risk, verdict, issues };

    await writeCachedReview(request.code, request.language, request.context, response);

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