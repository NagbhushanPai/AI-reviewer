## AI Code Review

Production-grade monorepo scaffold for a real-time AI code review MVP.

### Stack

- Next.js App Router frontend
- Monaco Editor
- React Query and Zustand
- Fastify API with Socket.IO realtime events
- Prisma, PostgreSQL, Redis, and OpenAI integration stubs

### Layout

- `apps/web` - Next.js frontend
- `apps/api` - Fastify backend
- `packages/config` - shared config
- `packages/types` - shared types
- `packages/utils` - shared helpers

### Next step

Install dependencies with `pnpm install`, then run `pnpm dev`.
