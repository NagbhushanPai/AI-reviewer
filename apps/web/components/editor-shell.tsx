"use client";

import Editor from "@monaco-editor/react";
import { useEffect } from "react";
import { getSocket } from "../lib/socket";
import { useUiStore } from "../store/ui";
import { useReviewSubmission } from "../hooks/use-review-submission";

const MAX_CODE_LENGTH = 200_000; // ~200 KB of characters
const SUPPORTED_LANGUAGES = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "TSX" },
  { value: "jsx", label: "JSX" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" }
];

export function EditorShell() {
  const code = useUiStore((state) => state.code);
  const language = useUiStore((state) => state.language);
  const context = useUiStore((state) => state.context);
  const latestReview = useUiStore((state) => state.latestReview);
  const streamedResponse = useUiStore((state) => state.streamedResponse);
  const status = useUiStore((state) => state.status);
  const setCode = useUiStore((state) => state.setCode);
  const setLanguage = useUiStore((state) => state.setLanguage);
  const setContext = useUiStore((state) => state.setContext);
  const reviewMutation = useReviewSubmission();

  const isOverLimit = code.length > MAX_CODE_LENGTH;
  const isReviewing = status === "reviewing";
  const canSubmit = !isReviewing && !isOverLimit && code.trim().length > 0;

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  function reviewSummary(): string {
    if (status === "reviewing") return streamedResponse || "Streaming analysis...";
    if (status === "error") return "Review failed. Please try again.";
    if (latestReview) return `${latestReview.verdict} · risk score ${latestReview.risk}`;
    return "Run a review to see findings and AI feedback here.";
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[28px] border border-white/10 bg-[var(--surface)] shadow-glow">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted)]">Source</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Paste code and review instantly</h2>
          </div>
          <button
            type="button"
            onClick={() => reviewMutation.mutate()}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmit}
            title={isOverLimit ? "Code exceeds the 200 000-character limit" : undefined}
          >
            {isReviewing ? "Reviewing..." : "Run review"}
          </button>
        </div>

        <div className="grid gap-4 border-b border-white/10 px-5 py-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            Language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[var(--surface-2)] px-4 py-3 text-sm text-white outline-none"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-[var(--muted)] md:col-span-2">
            Review focus
            <input
              value={context}
              onChange={(event) => setContext(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[var(--surface-2)] px-4 py-3 text-sm text-white outline-none"
              placeholder="What should the reviewer focus on?"
            />
          </label>
        </div>

        <div className="h-[72vh] min-h-[620px] p-3">
          <Editor
            height="100%"
            defaultLanguage="typescript"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value ?? "")}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontFamily: "var(--font-mono)",
              padding: { top: 18, bottom: 18 },
              roundedSelection: false
            }}
          />
        </div>

        {isOverLimit && (
          <p className="border-t border-white/10 px-5 py-3 text-xs text-[#ff7b8f]">
            Code exceeds the {MAX_CODE_LENGTH.toLocaleString()}-character limit (
            {code.length.toLocaleString()} chars). Trim the input to run a review.
          </p>
        )}
      </div>

      <aside className="rounded-[28px] border border-white/10 bg-[rgba(15,22,40,0.92)] p-5 shadow-glow backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted)]">Review</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Realtime feedback</h2>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              status === "error"
                ? "border-[#ff7b8f]/30 text-[#ff7b8f]"
                : status === "ready"
                  ? "border-[#71e4ff]/30 text-[#71e4ff]"
                  : "border-white/10 text-[var(--muted)]"
            }`}
          >
            {status.toUpperCase()}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <div
            className={`rounded-3xl border p-4 ${
              status === "error" ? "border-[#ff7b8f]/20 bg-[#ff7b8f]/5" : "border-white/10 bg-white/5"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Summary</p>
            <p className="mt-3 text-sm leading-6 text-slate-100">{reviewSummary()}</p>
          </div>

          <div className="space-y-3">
            {(latestReview?.issues ?? []).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--muted)]">
                No findings yet. The first review will populate this panel.
              </div>
            ) : (
              latestReview?.issues.map((finding, index) => (
                <article key={`${finding.issue}-${index}`} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        finding.severity === "high"
                          ? "bg-[#ff7b8f]/10 text-[#ff7b8f]"
                          : finding.severity === "medium"
                            ? "bg-[#ffd36e]/10 text-[#ffd36e]"
                            : "bg-[#71e4ff]/10 text-[#71e4ff]"
                      }`}
                    >
                      {finding.severity}
                    </span>
                    {finding.line ? <span className="text-xs text-[var(--muted)]">Line {finding.line}</span> : null}
                  </div>
                  <p className="mt-3 text-sm text-white">{finding.issue}</p>
                  {finding.suggestion ? <p className="mt-2 text-sm text-[var(--muted)]">{finding.suggestion}</p> : null}
                </article>
              ))
            )}
          </div>
        </div>
      </aside>
    </section>
  );
}