import { Feedback, User } from "@prisma/client";
import { Telegraf } from "telegraf";
import { BotContext } from "../types/context";
import { env } from "../config/env";
import { linkAdminMessage } from "./feedbackService";

type FeedbackWithCategory = Feedback & {
  category: { name: string } | null;
};

/**
 * Build the admin notification message text.
 * Anonymous submissions show only the alias; named submissions include
 * the full profile link.
 */
function formatAdminMessage(
  feedback: FeedbackWithCategory,
  user: User
): string {
  const categoryName = feedback.category?.name ?? "General";
  const id = `#${feedback.id}`;
  const date = new Date(feedback.createdAt).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let header: string;
  if (feedback.isAnonymous) {
    header = `<b>Anonymous</b>  <code>${feedback.sessionAlias}</code>`;
  } else {
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    const usernameLink = user.username
      ? ` · <a href="tg://user?id=${user.telegramId}">@${user.username}</a>`
      : ` · <a href="tg://user?id=${user.telegramId}">${name}</a>`;
    header = `<b>${name}</b>${usernameLink}`;
  }

  const lines = [
    header,
    `${categoryName}  ·  ${id}  ·  ${date}`,
    ``,
  ];

  if (feedback.content) {
    lines.push(feedback.content);
  }

  if (feedback.mediaType) {
    lines.push(`\n<i>[${feedback.mediaType} attached]</i>`);
  }

  lines.push(`\n<i>Reply to this message to respond to the sender.</i>`);

  return lines.join("\n");
}

/**
 * Send a feedback notification to the admin chat.
 * Handles both text-only and media feedback.
 * Saves the returned message_id so admin replies can be routed back.
 */
export async function sendAdminNotification(
  bot: Telegraf<BotContext>,
  feedback: FeedbackWithCategory,
  user: User
): Promise<void> {
  const adminChatId = env.ADMIN_CHAT_ID;
  const caption = formatAdminMessage(feedback, user);

  let sentMessage: { message_id: number };

  try {
    if (feedback.mediaFileId && feedback.mediaType) {
      const fileId = feedback.mediaFileId;

      switch (feedback.mediaType) {
        case "PHOTO":
          sentMessage = await bot.telegram.sendPhoto(adminChatId, fileId, {
            caption,
            parse_mode: "HTML",
          });
          break;
        case "VIDEO":
          sentMessage = await bot.telegram.sendVideo(adminChatId, fileId, {
            caption,
            parse_mode: "HTML",
          });
          break;
        case "VOICE":
          sentMessage = await bot.telegram.sendVoice(adminChatId, fileId, {
            caption,
            parse_mode: "HTML",
          });
          break;
        case "AUDIO":
          sentMessage = await bot.telegram.sendAudio(adminChatId, fileId, {
            caption,
            parse_mode: "HTML",
          });
          break;
        case "DOCUMENT":
          sentMessage = await bot.telegram.sendDocument(adminChatId, fileId, {
            caption,
            parse_mode: "HTML",
          });
          break;
        case "VIDEO_NOTE":
          // Video notes don't support captions, so send the note then a text message
          await bot.telegram.sendVideoNote(adminChatId, fileId);
          sentMessage = await bot.telegram.sendMessage(adminChatId, caption, {
            parse_mode: "HTML",
          });
          break;
        case "STICKER":
          // Stickers don't support captions either
          await bot.telegram.sendSticker(adminChatId, fileId);
          sentMessage = await bot.telegram.sendMessage(adminChatId, caption, {
            parse_mode: "HTML",
          });
          break;
        default:
          sentMessage = await bot.telegram.sendMessage(adminChatId, caption, {
            parse_mode: "HTML",
          });
      }
    } else {
      // Text-only feedback
      sentMessage = await bot.telegram.sendMessage(adminChatId, caption, {
        parse_mode: "HTML",
      });
    }

    // Store the message_id so replies can be routed back to the sender
    await linkAdminMessage(feedback.id, sentMessage.message_id);
  } catch (err) {
    console.error("[notificationService] Failed to send admin notification:", err);
    throw err;
  }
}
