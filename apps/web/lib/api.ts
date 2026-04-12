import type { ReviewRequest, ReviewResponse } from "@ai-review/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function submitReview(payload: ReviewRequest): Promise<ReviewResponse> {
  const response = await fetch(`${apiUrl}/api/v1/review`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Review request failed with status ${response.status}`);
  }

  return (await response.json()) as ReviewResponse;
}