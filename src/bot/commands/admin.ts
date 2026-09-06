import { BotContext } from "../../types/context";
import { banUser, unbanUser } from "../../services/userService";
import { getFeedbackStats } from "../../services/feedbackService";
import {
  addCategory,
  removeCategory,
  getActiveCategories,
} from "../../services/categoryService";
import { env } from "../../config/env";

/**
 * Guard: returns true if the update is from the designated admin chat.
 * All admin commands are only usable inside the admin chat/channel.
 */
function isAdminChat(ctx: BotContext): boolean {
  const chatId = ctx.chat?.id?.toString();
  return chatId === env.ADMIN_CHAT_ID;
}

/** Safely extract text from the current message. */
function messageText(ctx: BotContext): string {
  return ctx.message && "text" in ctx.message ? ctx.message.text : "";
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * /stats — Show aggregated feedback statistics.
 * Only works in the admin chat.
 */
export async function statsCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const stats = await getFeedbackStats();
  const anonPct =
    stats.total > 0 ? ((stats.anonymous / stats.total) * 100).toFixed(1) : "0";

  const categoryLines =
    stats.byCategory.length > 0
      ? stats.byCategory.map((c) => `  ${c.name}: ${c.count}`).join("\n")
      : "  General: " + stats.total;

  const text = [
    `<b>Feedback Statistics</b>`,
    ``,
    `<b>Total Submissions:</b> ${stats.total}`,
    `<b>Unique Users:</b> ${stats.uniqueUsers}`,
    `<b>Anonymous:</b> ${stats.anonymous} (${anonPct}%)`,
    ``,
    `<b>Status</b>`,
    `  Pending:  ${stats.pending}`,
    `  Reviewed: ${stats.reviewed}`,
    `  Archived: ${stats.archived}`,
    ``,
    `<b>By Category</b>`,
    categoryLines,
  ].join("\n");

  await ctx.reply(text, { parse_mode: "HTML" });
}

// ─── Ban / Unban ──────────────────────────────────────────────────────────────

/**
 * /ban <telegramId> [reason] — Ban a user from submitting feedback.
 * Only works in the admin chat.
 */
export async function banCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const parts = messageText(ctx).split(" ");

  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/ban &lt;telegramId&gt; [reason]</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const telegramId = parseInt(parts[1], 10);
  if (isNaN(telegramId)) {
    await ctx.reply("Invalid Telegram ID. Must be a number.");
    return;
  }

  const reason = parts.slice(2).join(" ") || undefined;
  const user = await banUser(telegramId, reason);

  if (!user) {
    await ctx.reply(
      `No user found with Telegram ID <code>${telegramId}</code>.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  await ctx.reply(
    [
      `<b>User banned</b>`,
      `Name: ${name}`,
      `ID: <code>${telegramId}</code>`,
      reason ? `Reason: ${reason}` : `Reason: not specified`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}

/**
 * /unban <telegramId> — Remove a ban from a user.
 * Only works in the admin chat.
 */
export async function unbanCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const parts = messageText(ctx).split(" ");

  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/unban &lt;telegramId&gt;</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const telegramId = parseInt(parts[1], 10);
  if (isNaN(telegramId)) {
    await ctx.reply("Invalid Telegram ID. Must be a number.");
    return;
  }

  const user = await unbanUser(telegramId);

  if (!user) {
    await ctx.reply(
      `No user found with Telegram ID <code>${telegramId}</code>.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  await ctx.reply(
    [
      `<b>User unbanned</b>`,
      `Name: ${name}`,
      `ID: <code>${telegramId}</code>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}

// ─── Category Management ──────────────────────────────────────────────────────

/**
 * /addcategory <name> — Add a new feedback category.
 * Once at least one category exists, users will see a category picker
 * before submitting feedback. Only works in the admin chat.
 *
 * Example: /addcategory Bug Report
 */
export async function addCategoryCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const parts = messageText(ctx).split(" ");
  const name = parts.slice(1).join(" ").trim();

  if (!name) {
    await ctx.reply(
      "Usage: <code>/addcategory &lt;name&gt;</code>\nExample: <code>/addcategory Bug Report</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const category = await addCategory(name);

  if (!category) {
    await ctx.reply(
      `A category named <b>${name}</b> already exists.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const active = await getActiveCategories();
  await ctx.reply(
    [
      `Category <b>${category.name}</b> added.`,
      ``,
      `<b>Active categories (${active.length}):</b>`,
      active.map((c) => `  · ${c.name}`).join("\n"),
      ``,
      `<i>Users will now see a category picker when submitting feedback.</i>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}

/**
 * /removecategory <name> — Remove a feedback category.
 * When all categories are removed, the picker disappears and all new
 * submissions are saved as "General". Only works in the admin chat.
 *
 * Example: /removecategory Bug Report
 */
export async function removeCategoryCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const parts = messageText(ctx).split(" ");
  const name = parts.slice(1).join(" ").trim();

  if (!name) {
    await ctx.reply(
      "Usage: <code>/removecategory &lt;name&gt;</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const deleted = await removeCategory(name);

  if (!deleted) {
    await ctx.reply(
      `No category found matching <b>${name}</b>.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const remaining = await getActiveCategories();

  const footer =
    remaining.length === 0
      ? `\n<i>No categories remain. Users will submit feedback without a picker.</i>`
      : `\n<b>Remaining categories (${remaining.length}):</b>\n` +
        remaining.map((c) => `  · ${c.name}`).join("\n");

  await ctx.reply(
    [`Category <b>${deleted.name}</b> removed.`, footer].join("\n"),
    { parse_mode: "HTML" }
  );
}

/**
 * /listcategories — List all active feedback categories.
 * Only works in the admin chat.
 */
export async function listCategoriesCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const categories = await getActiveCategories();

  if (categories.length === 0) {
    await ctx.reply(
      [
        `<b>No categories configured.</b>`,
        ``,
        `All feedback is currently submitted without a category picker.`,
        `Use <code>/addcategory &lt;name&gt;</code> to add one.`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  const list = categories.map((c, i) => `  ${i + 1}. ${c.name}`).join("\n");
  await ctx.reply(
    [
      `<b>Active categories (${categories.length})</b>`,
      ``,
      list,
      ``,
      `Use <code>/removecategory &lt;name&gt;</code> to remove one.`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}
