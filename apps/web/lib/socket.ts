import { io, type Socket } from "socket.io-client";
import type { SocketClientEvents, SocketServerEvents } from "@ai-review/types";

let socket: Socket<SocketClientEvents, SocketServerEvents> | null = null;

export function getSocket(): Socket<SocketClientEvents, SocketServerEvents> {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001", {
      autoConnect: false,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
  }

  return socket;
}