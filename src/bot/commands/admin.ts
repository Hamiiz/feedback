import { BotContext } from "../../types/context";
import { banUser, unbanUser } from "../../services/userService";
import {
  addCategory,
  removeCategory,
  getActiveCategories,
} from "../../services/categoryService";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";

function isAdminChat(ctx: BotContext): boolean {
  return ctx.chat?.id?.toString() === env.ADMIN_CHAT_ID;
}

function messageText(ctx: BotContext): string {
  return ctx.message && "text" in ctx.message ? ctx.message.text : "";
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * /stats — Show bot usage statistics.
 * Queries User and Category tables only (no feedback storage).
 */
export async function statsCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const [totalUsers, bannedUsers, anonUsers, categories] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { isAnonymous: true } }),
    getActiveCategories(),
  ]);

  const anonPct =
    totalUsers > 0 ? ((anonUsers / totalUsers) * 100).toFixed(1) : "0";

  const categoryList =
    categories.length > 0
      ? categories.map((c) => `  · ${c.name}`).join("\n")
      : "  None configured";

  const text = [
    `<b>Statistics</b>`,
    ``,
    `<b>Users</b>`,
    `  Total:     ${totalUsers}`,
    `  Banned:    ${bannedUsers}`,
    `  Anonymous: ${anonUsers} (${anonPct}%)`,
    ``,
    `<b>Active Categories</b>`,
    categoryList,
  ].join("\n");

  await ctx.reply(text, { parse_mode: "HTML" });
}

// ─── Ban / Unban ──────────────────────────────────────────────────────────────

export async function banCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const parts = messageText(ctx).split(" ");
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/ban &lt;telegramId&gt; [reason]</code>", { parse_mode: "HTML" });
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
    await ctx.reply(`No user found with Telegram ID <code>${telegramId}</code>.`, { parse_mode: "HTML" });
    return;
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  await ctx.reply(
    [`<b>User banned</b>`, `Name: ${name}`, `ID: <code>${telegramId}</code>`, reason ? `Reason: ${reason}` : `Reason: not specified`].join("\n"),
    { parse_mode: "HTML" }
  );
}

export async function unbanCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const parts = messageText(ctx).split(" ");
  if (parts.length < 2) {
    await ctx.reply("Usage: <code>/unban &lt;telegramId&gt;</code>", { parse_mode: "HTML" });
    return;
  }

  const telegramId = parseInt(parts[1], 10);
  if (isNaN(telegramId)) {
    await ctx.reply("Invalid Telegram ID. Must be a number.");
    return;
  }

  const user = await unbanUser(telegramId);

  if (!user) {
    await ctx.reply(`No user found with Telegram ID <code>${telegramId}</code>.`, { parse_mode: "HTML" });
    return;
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  await ctx.reply(
    [`<b>User unbanned</b>`, `Name: ${name}`, `ID: <code>${telegramId}</code>`].join("\n"),
    { parse_mode: "HTML" }
  );
}

// ─── Category Management ──────────────────────────────────────────────────────

export async function addCategoryCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const name = messageText(ctx).split(" ").slice(1).join(" ").trim();
  if (!name) {
    await ctx.reply(
      "Usage: <code>/addcategory &lt;name&gt;</code>\nExample: <code>/addcategory Bug Report</code>",
      { parse_mode: "HTML" }
    );
    return;
  }

  const category = await addCategory(name);
  if (!category) {
    await ctx.reply(`A category named <b>${name}</b> already exists.`, { parse_mode: "HTML" });
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

export async function removeCategoryCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const name = messageText(ctx).split(" ").slice(1).join(" ").trim();
  if (!name) {
    await ctx.reply("Usage: <code>/removecategory &lt;name&gt;</code>", { parse_mode: "HTML" });
    return;
  }

  const deleted = await removeCategory(name);
  if (!deleted) {
    await ctx.reply(`No category found matching <b>${name}</b>.`, { parse_mode: "HTML" });
    return;
  }

  const remaining = await getActiveCategories();
  const footer =
    remaining.length === 0
      ? `\n<i>No categories remain. Users will submit feedback without a picker.</i>`
      : `\n<b>Remaining (${remaining.length}):</b>\n` + remaining.map((c) => `  · ${c.name}`).join("\n");

  await ctx.reply([`Category <b>${deleted.name}</b> removed.`, footer].join("\n"), { parse_mode: "HTML" });
}

export async function listCategoriesCommand(ctx: BotContext): Promise<void> {
  if (!isAdminChat(ctx)) return;

  const categories = await getActiveCategories();

  if (categories.length === 0) {
    await ctx.reply(
      [`<b>No categories configured.</b>`, ``, `Use <code>/addcategory &lt;name&gt;</code> to add one.`].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  const list = categories.map((c, i) => `  ${i + 1}. ${c.name}`).join("\n");
  await ctx.reply(
    [`<b>Active categories (${categories.length})</b>`, ``, list, ``, `Use <code>/removecategory &lt;name&gt;</code> to remove one.`].join("\n"),
    { parse_mode: "HTML" }
  );
}
