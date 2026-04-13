import { create } from "zustand";
import type { ReviewResponse } from "@ai-review/types";

type UiState = {
  code: string;
  language: string;
  context: string;
  latestReview: ReviewResponse | null;
  streamedResponse: string;
  status: "idle" | "reviewing" | "ready" | "error";
  setCode: (code: string) => void;
  setLanguage: (language: string) => void;
  setContext: (context: string) => void;
  setLatestReview: (review: ReviewResponse | null) => void;
  setStreamedResponse: (value: string) => void;
  appendStreamedResponse: (value: string) => void;
  setStatus: (status: UiState["status"]) => void;
};

export const useUiStore = create<UiState>((set) => ({
  code: `export async function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}`,
  language: "typescript",
  context: "Focus on readability, runtime safety, and API design.",
  latestReview: null,
  streamedResponse: "",
  status: "idle",
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setContext: (context) => set({ context }),
  setLatestReview: (latestReview) => set({ latestReview }),
  setStreamedResponse: (streamedResponse) => set({ streamedResponse }),
  appendStreamedResponse: (value) =>
    set((state) => ({
      streamedResponse: state.streamedResponse + value
    })),
  setStatus: (status) => set({ status })
}));