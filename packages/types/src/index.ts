export type ReviewSeverity = "info" | "warning" | "error";

export interface ReviewFinding {
  id: string;
  message: string;
  severity: ReviewSeverity;
  line?: number;
  suggestion?: string;
  source: "heuristic" | "llm";
}

export interface ReviewRequest {
  code: string;
  language?: string;
  context?: string;
  repository?: string;
}

export interface ReviewResponse {
  summary: string;
  findings: ReviewFinding[];
}

export interface SocketServerEvents {
  "code:review": (payload: ReviewRequest) => void;
}

export interface SocketClientEvents {
  "review:result": (payload: ReviewResponse) => void;
  "review:error": (payload: { message: string }) => void;
}