import { createHash } from "node:crypto";
import type { ReviewResponse } from "@ai-review/types";
import { redis } from "../lib/redis.js";

function buildCacheKey(code: string, language?: string, context?: string): string {
  const hash = createHash("sha256")
    .update(JSON.stringify({ code, language: language ?? null, context: context ?? null }))
    .digest("hex");

  return `review:${hash}`;
}

export async function readCachedReview(code: string, language?: string, context?: string): Promise<ReviewResponse | null> {
  if (!redis) {
    return null;
  }

  const value = await redis.get(buildCacheKey(code, language, context));
  return value ? (JSON.parse(value) as ReviewResponse) : null;
}

export async function writeCachedReview(
  code: string,
  language: string | undefined,
  context: string | undefined,
  response: ReviewResponse
): Promise<void> {
  if (!redis) {
    return;
  }

  await redis.set(buildCacheKey(code, language, context), JSON.stringify(response), "EX", 60 * 30);
}