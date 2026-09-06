import { config } from "dotenv";
import { z } from "zod";

// Load .env file before validation
config();

const envSchema = z.object({
  // ── Bot ──────────────────────────────────────────────────────────────────
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),

  // ── Admin ─────────────────────────────────────────────────────────────────
  ADMIN_CHAT_ID: z
    .string()
    .min(1, "ADMIN_CHAT_ID is required")
    .transform((val) => val), // keep as string — Telegram accepts string chat IDs

  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // ── Server ────────────────────────────────────────────────────────────────
  PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3000)),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // ── Webhooks (production) ─────────────────────────────────────────────────
  WEBHOOK_DOMAIN: z.string().optional().default(""),
  WEBHOOK_SECRET: z.string().optional().default(""),

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3)),
  RATE_LIMIT_WINDOW_SECONDS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 30)),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("❌  Invalid environment configuration:");
  _parsed.error.errors.forEach((err) => {
    console.error(`   • ${err.path.join(".")}: ${err.message}`);
  });
  process.exit(1);
}

export const env = _parsed.data;

/** True when running in production mode (uses webhooks). */
export const isProduction = env.NODE_ENV === "production";

/** True when a webhook domain is configured. */
export const useWebhook = isProduction && env.WEBHOOK_DOMAIN.length > 0;
