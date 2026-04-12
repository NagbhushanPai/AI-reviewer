import type { FastifyInstance } from "fastify";

export function registerCorePlugins(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const message = error instanceof Error ? error.message : "Unexpected server error";
    reply.code(500).send({ message });
  });
}