import { BotContext } from "../../types/context";
import { upsertUser } from "../../services/userService";
import { Markup } from "telegraf";

/**
 * /start command handler.
 *
 * - Upserts the user in the database (creates on first visit).
 * - Sends a welcoming onboarding message with the main inline keyboard.
 */
export async function startCommand(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;

  // Ensure the user exists in our DB
  const user = await upsertUser(ctx.from);

  const anonStatus = user.isAnonymous
    ? "<b>Anonymous mode is ON</b>"
    : "<b>Anonymous mode is OFF</b>";

  const welcomeText = [
    `Welcome${user.firstName ? `, <b>${user.firstName}</b>` : ""}!`,
    ``,
    `I collect feedback and forward it to the team. Here's what you need to know:`,
    ``,
    `• Tap <b>Send Feedback</b> to submit your thoughts, bug reports, or suggestions.`,
    `• Use <b>Anonymous Mode</b> to control whether your name is visible to the team.`,
    ``,
    anonStatus,
  ].join("\n");

  await ctx.reply(welcomeText, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Send Feedback", "feedback:start")],
      [
        Markup.button.callback(
          user.isAnonymous ? "Turn Off Anonymous Mode" : "Turn On Anonymous Mode",
          "toggle:anonymous"
        ),
      ],
      [Markup.button.callback("Help", "help:show")],
    ]),
  });
}
