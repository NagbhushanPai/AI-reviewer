"use client";

import Editor from "@monaco-editor/react";
import { useEffect } from "react";
import { getSocket } from "../lib/socket";
import { useUiStore } from "../store/ui";
import { useReviewSubmission } from "../hooks/use-review-submission";

export function EditorShell() {
  const code = useUiStore((state) => state.code);
  const language = useUiStore((state) => state.language);
  const context = useUiStore((state) => state.context);
  const latestReview = useUiStore((state) => state.latestReview);
  const status = useUiStore((state) => state.status);
  const setCode = useUiStore((state) => state.setCode);
  const setLanguage = useUiStore((state) => state.setLanguage);
  const setContext = useUiStore((state) => state.setContext);
  const reviewMutation = useReviewSubmission();

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

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
            disabled={status === "reviewing"}
          >
            {status === "reviewing" ? "Reviewing..." : "Run review"}
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
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="tsx">TSX</option>
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
      </div>

      <aside className="rounded-[28px] border border-white/10 bg-[rgba(15,22,40,0.92)] p-5 shadow-glow backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted)]">Review</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Realtime feedback</h2>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]">
            {status.toUpperCase()}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">Summary</p>
            <p className="mt-3 text-sm leading-6 text-slate-100">
              {latestReview?.summary ?? "Run a review to see findings and AI feedback here."}
            </p>
          </div>

          <div className="space-y-3">
            {(latestReview?.findings ?? []).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--muted)]">
                No findings yet. The first review will populate this panel.
              </div>
            ) : (
              latestReview?.findings.map((finding) => (
                <article key={finding.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${finding.severity === "error" ? "bg-[#ff7b8f]/10 text-[#ff7b8f]" : finding.severity === "warning" ? "bg-[#ffd36e]/10 text-[#ffd36e]" : "bg-[#71e4ff]/10 text-[#71e4ff]"}`}>
                      {finding.severity}
                    </span>
                    {finding.line ? <span className="text-xs text-[var(--muted)]">Line {finding.line}</span> : null}
                  </div>
                  <p className="mt-3 text-sm text-white">{finding.message}</p>
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