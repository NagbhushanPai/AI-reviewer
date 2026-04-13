import OpenAI from "openai";
import type { ReviewRequest } from "@ai-review/types";
import { env } from "./env.js";

const client = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: 8000
    })
  : null;

export const REVIEW_SYSTEM_PROMPT = `You are a senior software engineer performing a code review.

Rules:
- Be concise
- Focus on bugs, performance, and security issues
- Avoid generic or stylistic advice

Return ONLY a JSON array, no markdown, no preamble:
[
  {
    "issue": "string",
    "severity": "low" | "medium" | "high",
    "suggestion": "string",
    "line": number | null
  }
]`;

const TIMEOUT_FALLBACK =
  '[{"issue":"Review timed out","severity":"low","suggestion":"Try again","line":null}]';

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("timeout") || message.includes("timed out");
}

function buildUserPrompt(input: ReviewRequest): string {
  return JSON.stringify({
    language: input.language ?? "unknown",
    repository: input.repository ?? null,
    context: input.context ?? null,
    code: input.code
  });
}

export async function createReviewCompletion(input: ReviewRequest): Promise<string> {
  if (!client) {
    return "[]";
  }

  try {
    const completion = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) }
      ]
    });

    return completion.choices[0]?.message?.content ?? "[]";
  } catch (error) {
    if (isTimeoutError(error)) {
      return TIMEOUT_FALLBACK;
    }

    throw error;
  }
}

export async function createReviewCompletionStream(
  input: ReviewRequest,
  onChunk: (chunk: string) => void
): Promise<string> {
  if (!client) {
    return "[]";
  }

  try {
    const stream = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.1,
      stream: true,
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) }
      ]
    });

    let content = "";

    for await (const chunk of stream) {
      const piece = chunk.choices[0]?.delta?.content ?? "";
      if (piece) {
        content += piece;
        onChunk(piece);
      }
    }

    return content || "[]";
  } catch (error) {
    if (isTimeoutError(error)) {
      onChunk(TIMEOUT_FALLBACK);
      return TIMEOUT_FALLBACK;
    }

    throw error;
  }
}