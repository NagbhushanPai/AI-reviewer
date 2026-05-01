## AI Code Review

Monorepo for a real-time AI code review MVP.

## What this project does

- Web app for pasting code and requesting AI review.
- API endpoint for synchronous review over HTTP.
- Realtime streaming review updates over Socket.IO.
- GitHub pull request webhook handling with automated PR comments.
- Basic static-analysis rules (AST) merged with LLM findings.
- Optional Redis caching for repeat review requests.

## Tech stack

- Frontend: Next.js (App Router), React, Monaco Editor, React Query, Zustand
- Backend: Fastify, Socket.IO, Zod
- AI: OpenAI SDK
- Data and infra: Prisma, PostgreSQL, Redis
- Tooling: TypeScript, Vitest, ESLint, pnpm workspaces

## Repository layout

- apps/web: Next.js frontend
- apps/api: Fastify backend
- packages/config: shared lint and tsconfig presets
- packages/types: shared TypeScript types
- packages/utils: shared utility package
- docker: Dockerfiles and docker-compose

## Prerequisites

- Node.js 20+
- pnpm 9+
- Optional for full feature set: PostgreSQL, Redis, OpenAI API key, GitHub token

## Environment variables

Create a root .env file for API settings.

Suggested values:

```env
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

DATABASE_URL=postgresql://ai_review:ai_review@localhost:5432/ai_review
REDIS_URL=redis://localhost:6379

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

GITHUB_TOKEN=
GITHUB_WEBHOOK_SECRET=

CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For the web app, use .env.local (or Docker env) with:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Install

```bash
pnpm install
```

## Run locally (recommended for development)

Starts shared package builds, API, and web app together:

```bash
pnpm dev
```

Expected endpoints:

- Web: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/health

## Test the project right now

Run quality checks:

```bash
pnpm lint
pnpm test
```

Quick API smoke tests (PowerShell):

```powershell
Invoke-RestMethod -Method Get http://localhost:3001/health

$body = @"
{
	"code": "function sum(values){ return values.reduce((a,b)=>a+b,0); }\nconsole.log(sum([1,2,3]));",
	"language": "javascript",
	"context": "Focus on bugs, performance, and security."
}
"@

Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/v1/review -ContentType "application/json" -Body $body
```

UI smoke test:

1. Open http://localhost:3000
2. Paste code into editor
3. Click Run review
4. Confirm status transitions from REVIEWING to READY and findings render

## Docker (optional)

From docker folder:

```bash
docker compose up --build
```

Services defined:

- postgres
- redis
- api
- web

## Scripts

At workspace root:

- pnpm dev: run local development workflow
- pnpm build: build all workspace packages and apps
- pnpm test: run all workspace tests
- pnpm lint: lint all workspace projects
- pnpm format: format repository

## Notes

- If OPENAI_API_KEY is empty, AI model output is skipped and AST-only findings may appear.
- Redis and PostgreSQL are optional for basic local review flow but required for full feature coverage.
- GitHub PR review automation requires GITHUB_TOKEN and webhook configuration.
