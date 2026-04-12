import { Server } from "socket.io";
import { env } from "./lib/env.js";
import { buildApp } from "./app.js";
import { registerSocketHandlers } from "./realtime/socket.js";

async function start(): Promise<void> {
  const app = buildApp();
  const io = new Server(app.server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true
    }
  });

  registerSocketHandlers(io);

  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();