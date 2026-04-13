import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./lib/env.js";
import { webhookRoutes } from "./github/webhook.routes.js";
import { reviewRoutes } from "./modules/review/review.routes.js";
import { registerCorePlugins } from "./plugins/index.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  registerCorePlugins(app);

  app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true
  });

  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute"
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "api"
  }));

  app.register(reviewRoutes, { prefix: "/api/v1" });
  app.register(webhookRoutes, { prefix: "/api/v1" });

  return app;
}