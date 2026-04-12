import { EditorShell } from "../components/editor-shell";

export default function Page() {
  return (
    <main className="min-h-screen overflow-hidden">
      <div className="grid-backdrop absolute inset-0 opacity-40" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-4 backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">AI Code Review</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              Ship code review like a product, not a demo.
            </h1>
          </div>

          <div className="grid gap-2 text-right text-sm text-[var(--muted)]">
            <span>Fastify API</span>
            <span>Socket.IO realtime</span>
            <span>Next.js + Monaco</span>
          </div>
        </header>

        <div className="relative mt-6 flex-1">
          <EditorShell />
        </div>
      </div>
    </main>
  );
}