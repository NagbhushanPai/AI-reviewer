export type ReviewSeverity = "low" | "medium" | "high";

export interface ReviewIssue {
  issue: string;
  severity: ReviewSeverity;
  suggestion: string;
  line: number | null;
  source: "ast" | "llm";
}

export interface ReviewRequest {
  code: string;
  language?: string;
  context?: string;
  repository?: string;
  sourcePath?: string;
}

export interface ReviewResponse {
  risk: number;
  verdict: "Needs changes" | "Review suggested" | "Looks good";
  issues: ReviewIssue[];
}

export interface SocketServerEvents {
  "code:review": (payload: ReviewRequest) => void;
}

export interface SocketClientEvents {
  "review:partial": (payload: { data: string }) => void;
  "review:done": () => void;
  "review:result": (payload: ReviewResponse) => void;
  "review:error": (payload: { message: string }) => void;
}