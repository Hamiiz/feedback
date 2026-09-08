import { Telegraf } from "telegraf";
import { BotContext } from "../types/context";
import { env } from "../config/env";

// Middlewares
import { loggerMiddleware } from "./middlewares/logger";
import { rateLimitMiddleware } from "./middlewares/rateLimit";
import { bannedCheckMiddleware } from "./middlewares/bannedCheck";
import { createSessionMiddleware } from "./middlewares/sessionManager";

// Commands
import { startCommand } from "./commands/start";
import { helpCommand } from "./commands/help";
import { anonymousCommand } from "./commands/anonymous";
import { statsCommand, banCommand, unbanCommand, addCategoryCommand, removeCategoryCommand, listCategoriesCommand } from "./commands/admin";

// Handlers
import { handleFeedbackMessage, startFeedbackFlow } from "./handlers/feedback";
import { handleAdminReply } from "./handlers/adminReply";
import { registerCallbackHandlers } from "./handlers/callbackQuery";

/**
 * Create and fully configure the Telegraf bot instance.
 *
 * Middleware chain (applied in order):
 *   1. Logger          — logs all incoming updates
 *   2. Session         — loads/saves Prisma-backed session data
 *   3. BannedCheck     — silently drops updates from banned users
 *   4. RateLimit       — throttles per-user message frequency
 *
 * Then commands, handlers, and inline keyboard callbacks are registered.
 */
export function createBot(): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

  // ── Middleware chain ──────────────────────────────────────────────────────
  bot.use(loggerMiddleware);
  bot.use(createSessionMiddleware());
  bot.use(bannedCheckMiddleware);
  bot.use(rateLimitMiddleware);

  // ── Commands ──────────────────────────────────────────────────────────────
  bot.command("start", startCommand);
  bot.command("help", helpCommand);
  bot.command("anonymous", anonymousCommand);
  bot.command("feedback", startFeedbackFlow);
  bot.command("cancel", async (ctx) => {
    const { cancelFeedback } = await import("./handlers/feedback");
    await cancelFeedback(ctx);
  });

  // Admin-only commands (work only inside the admin chat)
  bot.command("stats", statsCommand);
  bot.command("ban", banCommand);
  bot.command("unban", unbanCommand);
  bot.command("addcategory", addCategoryCommand);
  bot.command("removecategory", removeCategoryCommand);
  bot.command("listcategories", listCategoriesCommand);

  // ── Inline keyboard callbacks ─────────────────────────────────────────────
  registerCallbackHandlers(bot);

  // ── Message handler ───────────────────────────────────────────────────────
  // This catches all non-command messages. We check session state to decide
  // whether the user is in the middle of submitting feedback.
  bot.on("message", async (ctx) => {
    // Admin reply routing: relay replies in the admin chat back to users
    const isReply = await handleAdminReply(ctx, bot);
    if (isReply) return;

    // Only process feedback if the user is in the awaiting-feedback state
    if (ctx.session.awaitingFeedback) {
      await handleFeedbackMessage(ctx, bot);
      return;
    }

    // If not in a flow, nudge the user towards the main menu
    const msg = ctx.message;
    const isTextMessage = "text" in msg && msg.text && !msg.text.startsWith("/");
    if (isTextMessage) {
      await ctx.reply(
        "Tap <b>Send Feedback</b> to submit your feedback, or type /start to open the menu.",
        {
          parse_mode: "HTML",
        }
      );
    }
  });

  // ── Global error handler ──────────────────────────────────────────────────
  bot.catch((err, ctx) => {
    console.error(`[bot] Error for update ${ctx.updateType}:`, err);
  });

  return bot;
}
