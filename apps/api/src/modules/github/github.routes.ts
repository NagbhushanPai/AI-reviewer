import type { FastifyInstance } from "fastify";
import { webhookSchema } from "../../schemas/review.js";
import { env } from "../../lib/env.js";

export async function githubRoutes(app: FastifyInstance): Promise<void> {
  app.post("/github/webhook", async (request, reply) => {
    const signature = request.headers["x-hub-signature-256"];
    const payload = webhookSchema.parse(request.body);

    if (env.GITHUB_WEBHOOK_SECRET && !signature) {
      return reply.code(401).send({ message: "Missing GitHub webhook signature" });
    }

    return reply.send({
      received: true,
      action: payload.action ?? null,
      repository: payload.repository?.full_name ?? payload.repository?.name ?? null
    });
  });
}