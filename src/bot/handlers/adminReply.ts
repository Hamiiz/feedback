import { Telegraf } from "telegraf";
import { BotContext } from "../../types/context";
import { env } from "../../config/env";
import { getSenderByAdminMessageId } from "../../services/replyMapService";

/**
 * Handle admin replies in the admin chat.
 *
 * When an admin replies to a forwarded feedback notification:
 *   1. Looks up the original sender via the reply-routing map.
 *   2. Relays the reply to the original sender.
 */
export async function handleAdminReply(
  ctx: BotContext,
  bot: Telegraf<BotContext>
): Promise<void> {
  const chatId = ctx.chat?.id?.toString();
  if (chatId !== env.ADMIN_CHAT_ID) return;

  const message = ctx.message;
  if (!message) return;

  const repliedTo =
    "reply_to_message" in message ? message.reply_to_message : undefined;
  if (!repliedTo) return;

  // Look up the original sender from the reply-routing map
  const sender = await getSenderByAdminMessageId(repliedTo.message_id);
  if (!sender) return; // Not a feedback notification reply

  const senderTelegramId = Number(sender.userTelegramId);
  const senderName = sender.senderName;
  const prefix = `<b>Reply from Admin:</b>\n\n`;

  try {
    if ("text" in message && message.text) {
      await bot.telegram.sendMessage(senderTelegramId, `${prefix}${message.text}`, { parse_mode: "HTML" });
    } else if ("photo" in message && message.photo?.length) {
      const photo = message.photo[message.photo.length - 1];
      await bot.telegram.sendPhoto(senderTelegramId, photo.file_id, {
        caption: `${prefix}${message.caption ?? ""}`,
        parse_mode: "HTML",
      });
    } else if ("voice" in message && message.voice) {
      await bot.telegram.sendVoice(senderTelegramId, message.voice.file_id, {
        caption: prefix,
        parse_mode: "HTML",
      });
    } else if ("document" in message && message.document) {
      await bot.telegram.sendDocument(senderTelegramId, message.document.file_id, {
        caption: `${prefix}${message.caption ?? ""}`,
        parse_mode: "HTML",
      });
    } else if ("video" in message && message.video) {
      await bot.telegram.sendVideo(senderTelegramId, message.video.file_id, {
        caption: `${prefix}${message.caption ?? ""}`,
        parse_mode: "HTML",
      });
    } else {
      return; // Unsupported reply type
    }

    await ctx.reply(`Reply delivered to ${senderName}.`, {
      reply_parameters: { message_id: message.message_id },
    });
  } catch (err: unknown) {
    const apiErr = err as { response?: { error_code?: number } };
    if (apiErr?.response?.error_code === 403) {
      await ctx.reply("Could not deliver reply — the user has blocked the bot.", {
        reply_parameters: { message_id: message.message_id },
      });
    } else {
      console.error("[adminReply] Failed to relay reply:", err);
      await ctx.reply("Failed to deliver reply. Check logs.", {
        reply_parameters: { message_id: message.message_id },
      });
    }
  }
}
