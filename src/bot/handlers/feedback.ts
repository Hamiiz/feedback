import { Markup, Telegraf } from "telegraf";
import { Message } from "telegraf/types";
import { BotContext } from "../../types/context";
import { upsertUser } from "../../services/userService";
import { sendAdminNotification, MediaType } from "../../services/notificationService";
import { getActiveCategories, getCategoryById } from "../../services/categoryService";
import { nanoid } from "../../utils/nanoid";

/**
 * Extract media info from a Telegram message.
 */
function extractMedia(
  message: Message
): { mediaType: MediaType; mediaFileId: string } | null {
  if ("photo" in message && message.photo?.length) {
    return { mediaType: "PHOTO", mediaFileId: message.photo[message.photo.length - 1].file_id };
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
 * Initiate the feedback flow.
 *
 * - No categories configured → skip the picker, prompt directly.
 * - Categories exist → show a dynamic inline keyboard.
 */
export async function startFeedbackFlow(ctx: BotContext): Promise<void> {
  ctx.session.awaitingFeedback = false;
  ctx.session.selectedCategoryId = null;

  const categories = await getActiveCategories();

  if (categories.length === 0) {
    ctx.session.awaitingFeedback = true;
    await ctx.reply(
      ["<b>Send your feedback</b>", "", "You can include text, a photo, video, voice message, or a file.", "", "<i>Type /cancel to abort.</i>"].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  const buttons = categories.map((cat) =>
    Markup.button.callback(cat.name, `category:${cat.id}`)
  );

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
 * Handle category selection — saves to session and prompts for content.
 */
export async function handleCategorySelection(
  ctx: BotContext,
  categoryId: number,
  categoryName: string
): Promise<void> {
  ctx.session.selectedCategoryId = categoryId;
  ctx.session.awaitingFeedback = true;

  await ctx.editMessageText(
    [`Category: <b>${categoryName}</b>`, ``, `Now send your feedback — text, photo, video, voice message, or a file.`, ``, `<i>Type /cancel to abort.</i>`].join("\n"),
    { parse_mode: "HTML" }
  );
}

/**
 * Handle the actual feedback message.
 * No feedback content is stored in the database — the only DB write is
 * the reply-routing map created inside sendAdminNotification().
 */
export async function handleFeedbackMessage(
  ctx: BotContext,
  bot: Telegraf<BotContext>
): Promise<void> {
  if (!ctx.from || !ctx.message) return;

  const user = await upsertUser(ctx.from);
  const message = ctx.message;

  const content =
    "text" in message
      ? message.text
      : "caption" in message
      ? message.caption ?? undefined
      : undefined;

  const media = extractMedia(message);

  if (!content && !media) {
    await ctx.reply("I couldn't process that message type. Please send text, a photo, video, voice message, or a file.");
    return;
  }

  // Resolve category name if one was selected
  let categoryName: string | undefined;
  if (ctx.session.selectedCategoryId) {
    const cat = await getCategoryById(ctx.session.selectedCategoryId);
    categoryName = cat?.name;
  }

  // Generate a one-time alias for anonymous display — not persisted
  const sessionAlias = `ANON-${nanoid(5).toUpperCase()}`;

  // Reset session before the async notification so a restart mid-send
  // doesn't leave the user stuck in awaiting state
  ctx.session.awaitingFeedback = false;
  ctx.session.selectedCategoryId = null;

  const anonNote = user.isAnonymous
    ? "\nYour submission was sent <b>anonymously</b>."
    : "\nYour name was included with the submission.";

  await ctx.reply(
    ["<b>Feedback received. Thank you.</b>", "", anonNote, "", "<i>If you'd like to send more feedback, tap the button below.</i>"].join("\n"),
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([[Markup.button.callback("Send More Feedback", "feedback:start")]]),
    }
  );

  // Forward to admin and write the reply-routing map (non-blocking)
  sendAdminNotification(bot, {
    user,
    content,
    mediaType: media?.mediaType,
    mediaFileId: media?.mediaFileId,
    categoryName,
    isAnonymous: user.isAnonymous,
    sessionAlias,
  }).catch((err) => {
    console.error("[feedbackHandler] Admin notification failed:", err);
  });
}

/**
 * Cancel an in-progress submission.
 */
export async function cancelFeedback(ctx: BotContext): Promise<void> {
  ctx.session.awaitingFeedback = false;
  ctx.session.selectedCategoryId = null;

  await ctx.reply("Feedback submission cancelled.", {
    ...Markup.inlineKeyboard([[Markup.button.callback("Start New Feedback", "feedback:start")]]),
  });
}
