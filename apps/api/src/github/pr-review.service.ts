import type { FastifyBaseLogger } from "fastify";
import { reviewCode } from "../modules/review/review.service.js";
import { fetchPRDiff, postPRComment } from "./github.service.js";

type ProcessPullRequestInput = {
  owner: string;
  repo: string;
  pullNumber: number;
  token: string;
  logger: FastifyBaseLogger;
};

export async function processPullRequestReview(input: ProcessPullRequestInput): Promise<void> {
  const { owner, repo, pullNumber, token, logger } = input;

  logger.info({ event: "review_start", source: "github_pr" });

  const startedAt = Date.now();

  try {
    const diff = await fetchPRDiff(owner, repo, pullNumber, token);
    const review = await reviewCode(
      {
        code: diff,
        language: "diff",
        context: "Review this pull request diff. Focus only on added and changed code paths.",
        repository: `${owner}/${repo}`
      },
      {
        source: "github_pr",
        logger
      }
    );

    const latencyMs = Date.now() - startedAt;
    logger.info({ event: "llm_done", source: "github_pr", latencyMs });

    const lines = review.issues.map((issue) => {
      const lineText = issue.line ? `line ${issue.line}` : "line n/a";
      return `- [${issue.severity}] ${issue.issue} (${lineText})`;
    });

    const body = [
      "Automated PR review summary",
      "",
      `Verdict: ${review.verdict}`,
      `Risk score: ${review.risk}`,
      "",
      ...(lines.length > 0 ? lines : ["- No issues reported."])
    ].join("\n");

    await postPRComment(owner, repo, pullNumber, body, token);
  } catch (error) {
    logger.error({
      event: "review_error",
      source: "github_pr",
      error: error instanceof Error ? error.message : "Unknown error"
    });

    throw error;
  }
}
