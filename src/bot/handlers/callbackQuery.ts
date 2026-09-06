import { Telegraf } from "telegraf";
import { BotContext } from "../../types/context";
import {
  startFeedbackFlow,
  handleCategorySelection,
  cancelFeedback,
} from "./feedback";
import { toggleAnonymous, upsertUser } from "../../services/userService";
import { getCategoryById } from "../../services/categoryService";
import { Markup } from "telegraf";

/**
 * Central callback query router.
 *
 * All inline keyboard button presses are routed here via action patterns.
 * Uses a prefix:value convention for callback data strings.
 */
export function registerCallbackHandlers(bot: Telegraf<BotContext>): void {
  // ── Feedback flow ────────────────────────────────────────────────────────

  bot.action("feedback:start", async (ctx) => {
    await ctx.answerCbQuery();
    await startFeedbackFlow(ctx);
  });

  bot.action("feedback:cancel", async (ctx) => {
    await ctx.answerCbQuery("Cancelled.");
    await cancelFeedback(ctx);
  });

  // ── Category selection ────────────────────────────────────────────────────
  // Callback data format: "category:<id>" where id is the Category DB record id

  bot.action(/^category:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const categoryId = parseInt(ctx.match[1], 10);

    const category = await getCategoryById(categoryId);
    if (!category) {
      await ctx.answerCbQuery("Category no longer available.");
      return;
    }

    await handleCategorySelection(ctx, category.id, category.name);
  });

  // ── Anonymous toggle ──────────────────────────────────────────────────────

  bot.action("toggle:anonymous", async (ctx) => {
    await ctx.answerCbQuery();
    if (!ctx.from) return;

    await upsertUser(ctx.from);
    const updated = await toggleAnonymous(ctx.from.id);

    const newLabel = updated.isAnonymous
      ? "Turn Off Anonymous Mode"
      : "Turn On Anonymous Mode";

    const statusText = updated.isAnonymous
      ? "<b>Anonymous mode is now ON</b>\n\nThe team will see <code>ANON-XXXXX</code> instead of your name."
      : "<b>Anonymous mode is now OFF</b>\n\nYour name and profile will be shown with your submissions.";

    await ctx.editMessageText(statusText, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Send Feedback", "feedback:start")],
        [Markup.button.callback(newLabel, "toggle:anonymous")],
        [Markup.button.callback("Help", "help:show")],
      ]),
    });
  });

  // ── Help ──────────────────────────────────────────────────────────────────

  bot.action("help:show", async (ctx) => {
    await ctx.answerCbQuery();

    const helpText = [
      `<b>Help — Feedback Bot</b>`,
      ``,
      `<b>How it works</b>`,
      `1. Tap <b>Send Feedback</b> to start.`,
      `2. Send your message — text, photo, video, voice, or file.`,
      `4. Your feedback is instantly forwarded to the team.`,
      ``,
      `<b>Anonymous Mode</b>`,
      `<b>ON</b> — team sees <code>ANON-XXXXX</code> (no identity).`,
      `<b>OFF</b> — your name and profile link are included.`,
    ].join("\n");

    await ctx.reply(helpText, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Send Feedback", "feedback:start")],
      ]),
    });
  });
}
