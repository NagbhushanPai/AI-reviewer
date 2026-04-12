import type { Server } from "socket.io";
import type { SocketClientEvents, SocketServerEvents } from "@ai-review/types";
import { reviewCode } from "../modules/review/review.service.js";

export function registerSocketHandlers(io: Server<SocketServerEvents, SocketClientEvents>): void {
  io.on("connection", (socket) => {
    socket.on("code:review", async (payload) => {
      try {
        const result = await reviewCode(payload);
        socket.emit("review:result", result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown review error";
        socket.emit("review:error", { message });
      }
    });
  });
}