import { config as dotenvConfig } from "dotenv";
import { z } from "zod";

dotenvConfig({ path: "../../.env" });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  GITHUB_TOKEN: z.string().optional().default(""),
  GITHUB_WEBHOOK_SECRET: z.string().optional().default(""),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().default("http://localhost:3001")
});

export const env = envSchema.parse(process.env);