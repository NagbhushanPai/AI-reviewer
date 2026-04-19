import type { FastifyBaseLogger } from "fastify";
import type { Server } from "socket.io";
import type { SocketClientEvents, SocketServerEvents } from "@ai-review/types";
import { reviewCodeWithStream } from "../modules/review/review.service.js";

const MAX_CODE_BYTES = 256 * 1024; // 256 KB

export function registerSocketHandlers(
  io: Server<SocketServerEvents, SocketClientEvents>,
  logger?: FastifyBaseLogger
): void {
  io.on("connection", (socket) => {
    socket.on("code:review", async (payload) => {
      if (Buffer.byteLength(payload.code ?? "", "utf8") > MAX_CODE_BYTES) {
        socket.emit("review:error", { message: "Code payload exceeds the 256 KB size limit." });
        return;
      }

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