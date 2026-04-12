import Redis from "ioredis";
import { env } from "./env.js";

export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;