import { Context } from "telegraf";

/**
 * Shape of data stored in the Telegraf session (persisted in PostgreSQL
 * via the BotSession model).
 */
export interface SessionData {
  /** Whether the bot is currently waiting for the user to send feedback text/media. */
  awaitingFeedback: boolean;

  /**
   * The category ID the user selected before sending their feedback.
   * Null when no categories are configured (submission goes straight through).
   */
  selectedCategoryId: number | null;

  /**
   * Tracks the last time (epoch ms) we sent a rate-limit warning to this user.
   * Used to avoid spamming the warning message itself.
   */
  lastRateLimitWarnAt: number | null;
}

/** Default/initial session values — returned for brand-new sessions. */
export const defaultSession = (): SessionData => ({
  awaitingFeedback: false,
  selectedCategoryId: null,
  lastRateLimitWarnAt: null,
});

/** Extended Telegraf context that carries our session data. */
export type BotContext = Context & { session: SessionData };
