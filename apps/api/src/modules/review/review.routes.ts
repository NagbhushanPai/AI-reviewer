import type { FastifyInstance } from "fastify";
import { reviewRequestSchema } from "../../schemas/review.js";
import { reviewCode } from "./review.service.js";

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  app.post("/review", async (request, reply) => {
    const payload = reviewRequestSchema.parse(request.body);
    const result = await reviewCode(payload, {
      source: "http",
      logger: request.log
    });

    reply.header("cache-control", "no-store");
    return reply.send(result);
  });
}