import type { ReviewRequest, ReviewResponse } from "@ai-review/types";
import { submitReview as submitReviewHttp } from "../lib/api";
import { getSocket } from "../lib/socket";

export function submitReviewOverSocket(payload: ReviewRequest): Promise<ReviewResponse> {
  const socket = getSocket();

  if (!socket.connected) {
    socket.connect();
  }

  return new Promise<ReviewResponse>((resolve, reject) => {
    const cleanup = () => {
      socket.off("review:result", handleResult);
      socket.off("review:error", handleError);
    };

    const handleResult = (result: ReviewResponse) => {
      cleanup();
      resolve(result);
    };

    const handleError = (error: { message: string }) => {
      cleanup();
      reject(new Error(error.message));
    };

    socket.once("review:result", handleResult);
    socket.once("review:error", handleError);
    socket.emit("code:review", payload);
  });
}

export async function submitReview(payload: ReviewRequest): Promise<ReviewResponse> {
  try {
    return await submitReviewOverSocket(payload);
  } catch {
    return submitReviewHttp(payload);
  }
}