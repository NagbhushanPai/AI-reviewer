import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../lib/env.js";
import { processPullRequestReview } from "./pr-review.service.js";
import { acquirePrReviewLock, releasePrReviewLock } from "../services/pr-idempotency.service.js";

const pullRequestWebhookSchema = z.object({
  action: z.string(),
  repository: z.object({
    full_name: z.string(),
    name: z.string(),
    owner: z.object({
      login: z.string()
    })
  }),
  pull_request: z.object({
    number: z.number()
  })
});

export function verifyGithubSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post("/github/webhook", async (request, reply) => {
    const signature = request.headers["x-hub-signature-256"];

    if (env.GITHUB_WEBHOOK_SECRET) {
      if (typeof signature !== "string") {
        return reply.code(401).send({ message: "Missing x-hub-signature-256 header" });
      }

      const rawBody = JSON.stringify(request.body ?? {});
      const isValid = verifyGithubSignature(rawBody, signature, env.GITHUB_WEBHOOK_SECRET);

      if (!isValid) {
        return reply.code(401).send({ message: "Invalid GitHub webhook signature" });
      }
    }

    const payload = pullRequestWebhookSchema.parse(request.body);
    const isPullRequestEvent = payload.action === "opened" || payload.action === "synchronize";

    if (!isPullRequestEvent) {
      return reply.send({ received: true, ignored: true, action: payload.action });
    }

    if (!env.GITHUB_TOKEN) {
      app.log.warn({ event: "review_error", source: "github_pr", error: "GITHUB_TOKEN is not configured" });
      return reply.code(500).send({ message: "GITHUB_TOKEN is not configured" });
    }

    const { owner, name: repo } = payload.repository;
    const pullNumber = payload.pull_request.number;

    const acquired = await acquirePrReviewLock(owner.login, repo, pullNumber);
    if (!acquired) {
      app.log.info({
        event: "review_skipped",
        source: "github_pr",
        reason: "idempotency_lock_held",
        pr: `${owner.login}/${repo}#${pullNumber}`
      });
      return reply.send({ received: true, ignored: true, action: payload.action, reason: "duplicate" });
    }

    try {
      await processPullRequestReview({
        owner: owner.login,
        repo,
        pullNumber,
        token: env.GITHUB_TOKEN,
        logger: app.log
      });
    } finally {
      await releasePrReviewLock(owner.login, repo, pullNumber);
    }

    return reply.send({ received: true, action: payload.action });
  });
}
