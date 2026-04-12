import { z } from "zod";

export const reviewRequestSchema = z.object({
  code: z.string().min(1, "Code is required"),
  language: z.string().min(1).optional(),
  context: z.string().optional(),
  repository: z.string().optional()
});

export const webhookSchema = z.object({
  action: z.string().optional(),
  repository: z
    .object({
      full_name: z.string().optional(),
      name: z.string().optional()
    })
    .passthrough()
    .optional()
}).passthrough();