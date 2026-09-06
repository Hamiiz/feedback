import { MiddlewareFn } from "telegraf";
import { BotContext } from "../../types/context";

/**
 * Structured request logger middleware.
 * Logs every incoming Telegram update with its type and the user who sent it.
 */
export const loggerMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const start = Date.now();
  const from = ctx.from;
  const updateType = ctx.updateType;
  const chatType = ctx.chat?.type ?? "unknown";

  const userLabel = from
    ? `${from.first_name}${from.username ? ` (@${from.username})` : ""} [${from.id}]`
    : "unknown";

  console.log(`→ [${updateType}] ${chatType} | user: ${userLabel}`);

  await next();

  const ms = Date.now() - start;
  console.log(`← [${updateType}] handled in ${ms}ms`);
};
