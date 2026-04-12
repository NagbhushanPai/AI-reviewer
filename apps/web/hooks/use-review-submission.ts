"use client";

import { useMutation } from "@tanstack/react-query";
import { useUiStore } from "../store/ui";
import { submitReview } from "../services/review";

export function useReviewSubmission() {
  const setLatestReview = useUiStore((state) => state.setLatestReview);
  const setStatus = useUiStore((state) => state.setStatus);

  return useMutation({
    mutationFn: async () =>
      submitReview({
        code: useUiStore.getState().code,
        language: useUiStore.getState().language,
        context: useUiStore.getState().context
      }),
    onMutate: () => setStatus("reviewing"),
    onSuccess: (result) => {
      setLatestReview(result);
      setStatus("ready");
    },
    onError: () => setStatus("error")
  });
}