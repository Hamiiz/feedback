import { User } from "@prisma/client";
import { Telegraf } from "telegraf";
import { BotContext } from "../types/context";
import { env } from "../config/env";
import { storeReplyMap } from "./replyMapService";

// Local type — no longer tied to the Prisma MediaType enum (which is removed)
export type MediaType =
  | "PHOTO"
  | "VIDEO"
  | "VOICE"
  | "AUDIO"
  | "DOCUMENT"
  | "STICKER"
  | "VIDEO_NOTE";

export type FeedbackPayload = {
  user: User;
  content?: string;
  mediaType?: MediaType;
  mediaFileId?: string;
  categoryName?: string; // Resolved category name, or undefined = "General"
  isAnonymous: boolean;
  sessionAlias: string;  // Generated on the fly, not persisted
};

/**
 * Format the admin notification message.
 */
function formatMessage(payload: FeedbackPayload): string {
  const category = payload.categoryName ?? "General";
  const date = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Nairobi", // East Africa Time (EAT)
  }) + " EAT";

  let header: string;
  if (payload.isAnonymous) {
    header = `<b>Anonymous</b>  <code>${payload.sessionAlias}</code>`;
  } else {
    const name = [payload.user.firstName, payload.user.lastName]
      .filter(Boolean)
      .join(" ");
    const link = payload.user.username
      ? ` · <a href="tg://user?id=${payload.user.telegramId}">@${payload.user.username}</a>`
      : ` · <a href="tg://user?id=${payload.user.telegramId}">${name}</a>`;
    header = `<b>${name}</b>${link}`;
  }

  const lines = [header, `${category}  ·  ${date}`, ``];

  if (payload.content) lines.push(payload.content);
  if (payload.mediaType) lines.push(`\n<i>[${payload.mediaType} attached]</i>`);

  lines.push(`\n<i>Reply to this message to respond to the sender.</i>`);

  return lines.join("\n");
}

/**
 * Forward a feedback notification to the admin chat, then store the
 * reply-routing map. This is the only DB write per submission.
 */
export async function sendAdminNotification(
  bot: Telegraf<BotContext>,
  payload: FeedbackPayload
): Promise<void> {
  const adminChatId = env.ADMIN_CHAT_ID;
  const caption = formatMessage(payload);
  const { user, mediaFileId, mediaType } = payload;

  let sentMessage: { message_id: number };

  try {
    if (mediaFileId && mediaType) {
      switch (mediaType) {
        case "PHOTO":
          sentMessage = await bot.telegram.sendPhoto(adminChatId, mediaFileId, { caption, parse_mode: "HTML" });
          break;
        case "VIDEO":
          sentMessage = await bot.telegram.sendVideo(adminChatId, mediaFileId, { caption, parse_mode: "HTML" });
          break;
        case "VOICE":
          sentMessage = await bot.telegram.sendVoice(adminChatId, mediaFileId, { caption, parse_mode: "HTML" });
          break;
        case "AUDIO":
          sentMessage = await bot.telegram.sendAudio(adminChatId, mediaFileId, { caption, parse_mode: "HTML" });
          break;
        case "DOCUMENT":
          sentMessage = await bot.telegram.sendDocument(adminChatId, mediaFileId, { caption, parse_mode: "HTML" });
          break;
        case "VIDEO_NOTE":
          await bot.telegram.sendVideoNote(adminChatId, mediaFileId);
          sentMessage = await bot.telegram.sendMessage(adminChatId, caption, { parse_mode: "HTML" });
          break;
        case "STICKER":
          await bot.telegram.sendSticker(adminChatId, mediaFileId);
          sentMessage = await bot.telegram.sendMessage(adminChatId, caption, { parse_mode: "HTML" });
          break;
        default:
          sentMessage = await bot.telegram.sendMessage(adminChatId, caption, { parse_mode: "HTML" });
      }
    } else {
      sentMessage = await bot.telegram.sendMessage(adminChatId, caption, { parse_mode: "HTML" });
    }

    // Store the reply-routing map — the only DB write per submission
    await storeReplyMap(
      sentMessage.message_id,
      user.telegramId,
      user.firstName
    );
  } catch (err) {
    console.error("[notificationService] Failed to send admin notification:", err);
    throw err;
  }
}
