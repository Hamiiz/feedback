import { MiddlewareFn } from "telegraf";
import { BotContext } from "../../types/context";
import { prisma } from "../../config/prisma";

/**
 * Banned-user guard middleware.
 *
 * On every incoming update, checks whether the sender is banned in the DB.
 * Banned users are silently dropped — no reply is sent (this avoids giving
 * them feedback that they've been detected/banned).
 *
 * Results are NOT cached in memory intentionally so that a ban/unban takes
 * effect on the very next message without requiring a bot restart.
 */
export const bannedCheckMiddleware: MiddlewareFn<BotContext> = async (
  ctx,
  next
) => {
  if (!ctx.from) return next();

  const telegramId = BigInt(ctx.from.id);

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { isBanned: true },
  });

  // If user doesn't exist yet, they can't be banned — let them through
  if (!user || !user.isBanned) {
    return next();
  }

  // Silently drop the update
  console.log(`[ban] Dropped update from banned user ${ctx.from.id}`);
};
