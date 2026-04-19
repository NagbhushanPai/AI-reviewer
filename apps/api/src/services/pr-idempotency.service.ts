import { redis } from "../lib/redis.js";

/**
 * Redis-backed idempotency lock for PR reviews.
 *
 * When a `pull_request` webhook fires (opened / synchronize) we acquire a
 * short-lived lock.  A second webhook for the same PR that arrives while the
 * lock is held is silently dropped, preventing duplicate AI comments caused by
 * rapid-fire `synchronize` events or webhook re-deliveries.
 */
const LOCK_TTL_SECONDS = 300; // 5 min – covers typical review latency + retry window

function lockKey(owner: string, repo: string, pullNumber: number): string {
  return `pr_review:${owner}/${repo}#${pullNumber}`;
}

/**
 * Attempt to acquire the idempotency lock.
 * @returns `true` if the lock was acquired and the review should proceed.
 *          `false` if a review for this PR is already in progress (skip).
 */
export async function acquirePrReviewLock(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<boolean> {
  if (!redis) {
    return true; // No Redis configured – allow all reviews.
  }

  const result = await redis.set(lockKey(owner, repo, pullNumber), "1", "EX", LOCK_TTL_SECONDS, "NX");
  return result === "OK";
}

/**
 * Release the idempotency lock after the review completes (success or error).
 */
export async function releasePrReviewLock(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.del(lockKey(owner, repo, pullNumber));
}
