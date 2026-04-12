import OpenAI from "openai";
import type { ReviewFinding, ReviewRequest, ReviewResponse } from "@ai-review/types";
import { safeJsonParse, withRetry } from "@ai-review/utils";
import { env } from "./env.js";

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

function normalizeFindings(findings: Array<Partial<ReviewFinding>>): ReviewFinding[] {
  return findings
    .filter((finding) => typeof finding.message === "string" && typeof finding.severity === "string")
    .map((finding, index) => ({
      id: finding.id ?? `llm-${index + 1}`,
      message: finding.message ?? "",
      severity: finding.severity as ReviewFinding["severity"],
      line: typeof finding.line === "number" ? finding.line : undefined,
      suggestion: finding.suggestion,
      source: "llm"
    }));
}

export async function callReviewModel(input: ReviewRequest): Promise<ReviewResponse> {
  if (!client) {
    return {
      summary: "OpenAI is not configured, so only heuristic checks were used.",
      findings: []
    };
  }

  const completion = await withRetry(
    () =>
      client.chat.completions.create({
        model: env.OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a strict senior engineer reviewing a single code snippet. Return valid JSON with keys summary and findings. Each finding should include message, severity, line, and suggestion when relevant."
          },
          {
            role: "user",
            content: JSON.stringify({
              language: input.language ?? "unknown",
              repository: input.repository ?? null,
              context: input.context ?? null,
              code: input.code
            })
          }
        ]
      }),
    3,
    400
  );

  const content = completion.choices[0]?.message?.content ?? "{}";
  const parsed = safeJsonParse<Partial<ReviewResponse>>(content, {});

  return {
    summary: parsed.summary ?? "AI review completed.",
    findings: Array.isArray(parsed.findings) ? normalizeFindings(parsed.findings as Array<Partial<ReviewFinding>>) : []
  };
}