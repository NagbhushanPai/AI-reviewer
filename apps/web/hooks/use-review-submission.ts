"use client";

import { useMutation } from "@tanstack/react-query";
import { getSocket } from "../lib/socket";
import { useUiStore } from "../store/ui";
import { submitReview } from "../services/review";

export function useReviewSubmission() {
  const setLatestReview = useUiStore((state) => state.setLatestReview);
  const setStatus = useUiStore((state) => state.setStatus);
  const setStreamedResponse = useUiStore((state) => state.setStreamedResponse);
  const appendStreamedResponse = useUiStore((state) => state.appendStreamedResponse);

  return useMutation({
    mutationFn: async () =>
      submitReview({
        code: useUiStore.getState().code,
        language: useUiStore.getState().language,
        context: useUiStore.getState().context
      }),
    onMutate: () => {
      const socket = getSocket();
      const onPartial = (payload: { data: string }) => appendStreamedResponse(payload.data);
      const onDone = () => setStatus("ready");

      setStreamedResponse("");
      setStatus("reviewing");

      socket.on("review:partial", onPartial);
      socket.once("review:done", onDone);

      return {
        cleanup: () => {
          socket.off("review:partial", onPartial);
          socket.off("review:done", onDone);
        }
      };
    },
    onSuccess: (result) => {
      setLatestReview(result);
      setStatus("ready");
    },
    onError: () => setStatus("error"),
    onSettled: (_data, _error, _variables, context) => {
      context?.cleanup();
    }
  });
}