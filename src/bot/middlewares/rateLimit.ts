import { MiddlewareFn } from "telegraf";
import { BotContext } from "../../types/context";
import { env } from "../../config/env";

// In-memory store: userId → array of message timestamps (epoch ms)
const messageLog = new Map<number, number[]>();

const MAX = env.RATE_LIMIT_MAX;
const WINDOW_MS = env.RATE_LIMIT_WINDOW_SECONDS * 1_000;

// How long to wait before sending another rate-limit warning (avoid spamming)
const WARN_COOLDOWN_MS = 10_000;

/**
 * Per-user rate limiter (sliding window).
 *
 * Allows a max of RATE_LIMIT_MAX messages within RATE_LIMIT_WINDOW_SECONDS.
 * When exceeded:
 *   - The update is dropped (not forwarded to next middleware).
 *   - A throttle warning is sent at most once per WARN_COOLDOWN_MS.
 */
export const rateLimitMiddleware: MiddlewareFn<BotContext> = async (
  ctx,
  next
) => {
  // Only rate-limit regular user messages (not callbacks, not admin channel)
  if (!ctx.from || !ctx.message) return next();

  const userId = ctx.from.id;
  const now = Date.now();

  // Retrieve or initialise the sliding window for this user
  const timestamps = (messageLog.get(userId) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );

  if (timestamps.length >= MAX) {
    // Rate limit exceeded — send a warning (but not too often)
    const lastWarn = ctx.session.lastRateLimitWarnAt ?? 0;
    if (now - lastWarn > WARN_COOLDOWN_MS) {
      ctx.session.lastRateLimitWarnAt = now;
      await ctx.reply(
        `You're sending messages too fast.\nPlease wait a few seconds before submitting more feedback.`,
        { parse_mode: "HTML" }
      );
    }
    return; // Drop the update
  }

  timestamps.push(now);
  messageLog.set(userId, timestamps);

  return next();
};

/** Clean up stale entries periodically to prevent unbounded memory growth. */
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of messageLog.entries()) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) {
      messageLog.delete(userId);
    } else {
      messageLog.set(userId, fresh);
    }
  }
}, 60_000);
