import { Markup, Telegraf } from "telegraf";
import { Message } from "telegraf/types";
import { MediaType } from "@prisma/client";
import { BotContext } from "../../types/context";
import { upsertUser } from "../../services/userService";
import { saveFeedback } from "../../services/feedbackService";
import { sendAdminNotification } from "../../services/notificationService";
import { getActiveCategories } from "../../services/categoryService";
import { prisma } from "../../config/prisma";

/**
 * Initiate the feedback flow.
 *
 * - If no categories are configured: skip the picker, go straight to awaiting the message.
 * - If categories exist: show an inline keyboard for the user to pick one.
 */
export async function startFeedbackFlow(ctx: BotContext): Promise<void> {
  ctx.session.awaitingFeedback = false;
  ctx.session.selectedCategoryId = null;

  const categories = await getActiveCategories();

  if (categories.length === 0) {
    // No categories configured — go straight to submission
    ctx.session.awaitingFeedback = true;
    await ctx.reply(
      [
        "<b>Send your feedback</b>",
        "",
        "You can include text, a photo, video, voice message, or a file.",
        "",
        "<i>Type /cancel to abort.</i>",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  // Categories are configured — show the picker
  const buttons = categories.map((cat) =>
    Markup.button.callback(cat.name, `category:${cat.id}`)
  );

  // Arrange in rows of 2
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  rows.push([Markup.button.callback("Cancel", "feedback:cancel")]);

  await ctx.reply("<b>Choose a category for your feedback:</b>", {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard(rows),
  });
}

/**
 * Handle category selection from the inline keyboard.
 * Saves the chosen category ID in session and prompts for content.
 */
export async function handleCategorySelection(
  ctx: BotContext,
  categoryId: number,
  categoryName: string
): Promise<void> {
  ctx.session.selectedCategoryId = categoryId;
  ctx.session.awaitingFeedback = true;

  await ctx.editMessageText(
    [
      `Category: <b>${categoryName}</b>`,
      ``,
      `Now send your feedback — you can include text, a photo, video, voice message, or a file.`,
      ``,
      `<i>Type /cancel to abort.</i>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
}

/**
 * Helper: extract media info from a Telegram message.
 */
function extractMedia(
  message: Message
): { mediaType: MediaType; mediaFileId: string } | null {
  if ("photo" in message && message.photo?.length) {
    const largest = message.photo[message.photo.length - 1];
    return { mediaType: "PHOTO", mediaFileId: largest.file_id };
  }
  if ("video" in message && message.video) {
    return { mediaType: "VIDEO", mediaFileId: message.video.file_id };
  }
  if ("voice" in message && message.voice) {
    return { mediaType: "VOICE", mediaFileId: message.voice.file_id };
  }
  if ("audio" in message && message.audio) {
    return { mediaType: "AUDIO", mediaFileId: message.audio.file_id };
  }
  if ("document" in message && message.document) {
    return { mediaType: "DOCUMENT", mediaFileId: message.document.file_id };
  }
  if ("sticker" in message && message.sticker) {
    return { mediaType: "STICKER", mediaFileId: message.sticker.file_id };
  }
  if ("video_note" in message && message.video_note) {
    return { mediaType: "VIDEO_NOTE", mediaFileId: message.video_note.file_id };
  }
  return null;
}

/**
 * Handle incoming message when the bot is awaiting feedback content.
 * Saves to DB, notifies admin, and confirms to the user.
 */
export async function handleFeedbackMessage(
  ctx: BotContext,
  bot: Telegraf<BotContext>
): Promise<void> {
  if (!ctx.from || !ctx.message) return;

  const user = await upsertUser(ctx.from);
  const message = ctx.message;

  // Extract text and media
  const content =
    "text" in message
      ? message.text
      : "caption" in message
      ? message.caption ?? undefined
      : undefined;

  const media = extractMedia(message);

  if (!content && !media) {
    await ctx.reply(
      "I couldn't process that message type. Please send text, a photo, video, voice message, or a file."
    );
    return;
  }

  // Save to database — include category if one was selected
  const feedback = await saveFeedback({
    userId: user.id,
    content,
    mediaType: media?.mediaType,
    mediaFileId: media?.mediaFileId,
    categoryId: ctx.session.selectedCategoryId ?? undefined,
    isAnonymous: user.isAnonymous,
  });

  // Load the full feedback record with its category relation for the notification
  const feedbackWithCategory = await prisma.feedback.findUniqueOrThrow({
    where: { id: feedback.id },
    include: { category: { select: { name: true } } },
  });

  // Reset session state
  ctx.session.awaitingFeedback = false;
  ctx.session.selectedCategoryId = null;

  const anonNote = user.isAnonymous
    ? "\nYour submission was sent <b>anonymously</b>."
    : "\nYour name was included with the submission.";

  await ctx.reply(
    [
      `<b>Feedback received. Thank you.</b>`,
      ``,
      `Submission ID: <code>#${feedback.id}</code>`,
      anonNote,
      ``,
      `<i>If you'd like to send more feedback, just tap the button below.</i>`,
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Send More Feedback", "feedback:start")],
      ]),
    }
  );

  // Notify admins (non-blocking)
  sendAdminNotification(bot, feedbackWithCategory, user).catch((err) => {
    console.error("[feedbackHandler] Admin notification failed:", err);
  });
}

/**
 * Cancel an in-progress feedback submission.
 */
export async function cancelFeedback(ctx: BotContext): Promise<void> {
  ctx.session.awaitingFeedback = false;
  ctx.session.selectedCategoryId = null;

  await ctx.reply("Feedback submission cancelled.", {
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Start New Feedback", "feedback:start")],
    ]),
  });
}
