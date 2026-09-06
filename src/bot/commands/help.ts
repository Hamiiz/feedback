import { BotContext } from "../../types/context";

/**
 * /help command handler.
 * Explains all available commands and how anonymous mode works.
 */
export async function helpCommand(ctx: BotContext): Promise<void> {
  const helpText = [
    `<b>Help — Feedback Bot</b>`,
    ``,
    `<b>Commands</b>`,
    `/start — Open the main menu`,
    `/feedback — Start a feedback submission`,
    `/anonymous — Toggle your anonymous mode on or off`,
    `/help — Show this message`,
    ``,
    `<b>How it works</b>`,
    `1. Tap <b>Send Feedback</b> or type /feedback.`,
    `2. Send your message (text, photo, video, voice — anything!).`,
    `3. Your feedback is instantly forwarded to the team.`,
    ``,
    `<b>Anonymous Mode</b>`,
    `When <b>ON</b> — the team sees <code>ANON-XXXXX</code> instead of your name.`,
    `When <b>OFF</b> — your name and profile link are shown.`,
    `You can toggle this any time with /anonymous.`,
    ``,
    `<b>Admin Replies</b>`,
    `If the team replies to your feedback, you'll receive their response here.`,
  ].join("\n");

  await ctx.reply(helpText, { parse_mode: "HTML" });
}
