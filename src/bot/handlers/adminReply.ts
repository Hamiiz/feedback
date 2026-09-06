import { Telegraf } from "telegraf";
import { BotContext } from "../../types/context";
import { env } from "../../config/env";
import { getFeedbackByAdminMessageId } from "../../services/feedbackService";

/**
 * Handle admin replies in the admin chat.
 *
 * When an admin replies to a forwarded feedback notification message,
 * this handler:
 *   1. Identifies the original feedback by the replied-to message_id.
 *   2. Looks up the original sender's telegramId.
 *   3. Relays the admin's reply to the original sender.
 *
 * This creates a seamless two-way communication channel while keeping
 * the user's identity private from admins in anonymous mode.
 */
export async function handleAdminReply(
  ctx: BotContext,
  bot: Telegraf<BotContext>
): Promise<void> {
  // Only process messages from the admin chat
  const chatId = ctx.chat?.id?.toString();
  if (chatId !== env.ADMIN_CHAT_ID) return;

  const message = ctx.message;
  if (!message) return;

  // Only handle replies (messages that reference another message)
  const repliedTo =
    "reply_to_message" in message ? message.reply_to_message : undefined;
  if (!repliedTo) return;

  const repliedMessageId = repliedTo.message_id;

  // Find the feedback linked to this admin message
  const feedback = await getFeedbackByAdminMessageId(repliedMessageId);
  if (!feedback) return; // Reply is not to a feedback notification

  const senderTelegramId = Number(feedback.user.telegramId);
  const senderName = feedback.user.firstName;

  // Build the relay message prefix
  const adminName = ctx.from?.first_name ?? "Admin";
  const prefix = `<b>Reply from the team (${adminName}):</b>\n\n`;

  try {
    // Relay text replies
    if ("text" in message && message.text) {
      await bot.telegram.sendMessage(
        senderTelegramId,
        `${prefix}${message.text}`,
        { parse_mode: "HTML" }
      );
    }
    // Relay photo replies
    else if ("photo" in message && message.photo?.length) {
      const photo = message.photo[message.photo.length - 1];
      await bot.telegram.sendPhoto(senderTelegramId, photo.file_id, {
        caption: `${prefix}${message.caption ?? ""}`,
        parse_mode: "HTML",
      });
    }
    // Relay voice replies
    else if ("voice" in message && message.voice) {
      await bot.telegram.sendVoice(senderTelegramId, message.voice.file_id, {
        caption: prefix,
        parse_mode: "HTML",
      });
    }
    // Relay document replies
    else if ("document" in message && message.document) {
      await bot.telegram.sendDocument(
        senderTelegramId,
        message.document.file_id,
        {
          caption: `${prefix}${message.caption ?? ""}`,
          parse_mode: "HTML",
        }
      );
    }
    // Relay video replies
    else if ("video" in message && message.video) {
      await bot.telegram.sendVideo(senderTelegramId, message.video.file_id, {
        caption: `${prefix}${message.caption ?? ""}`,
        parse_mode: "HTML",
      });
    }
    // Fallback: unsupported reply type
    else {
      console.log("[adminReply] Unsupported reply type, skipping relay.");
      return;
    }

    // Confirm to admin that the reply was delivered
    await ctx.reply(`Reply delivered to ${senderName}.`, {
      reply_parameters: { message_id: message.message_id },
    });
  } catch (err: unknown) {
    const apiErr = err as { response?: { error_code?: number } };
    // Handle cases where the user has blocked the bot
    if (apiErr?.response?.error_code === 403) {
      await ctx.reply(
        `Could not deliver reply — the user has blocked the bot.`,
        { reply_parameters: { message_id: message.message_id } }
      );
    } else {
      console.error("[adminReply] Failed to relay reply:", err);
      await ctx.reply(`Failed to deliver reply. Check logs.`, {
        reply_parameters: { message_id: message.message_id },
      });
    }
  }
}
