import type { FastifyBaseLogger } from "fastify";
import type { Server } from "socket.io";
import type { SocketClientEvents, SocketServerEvents } from "@ai-review/types";
import { reviewCodeWithStream } from "../modules/review/review.service.js";

export function registerSocketHandlers(
  io: Server<SocketServerEvents, SocketClientEvents>,
  logger?: FastifyBaseLogger
): void {
  io.on("connection", (socket) => {
    socket.on("code:review", async (payload) => {
      try {
        const result = await reviewCodeWithStream(
          payload,
          (chunk) => {
            socket.emit("review:partial", { data: chunk });
          },
          {
            source: "socket",
            logger
          }
        );

        socket.emit("review:done");
        socket.emit("review:result", result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown review error";
        socket.emit("review:error", { message });
      }
    });
  });
}