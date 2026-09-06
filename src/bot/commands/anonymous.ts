import { BotContext } from "../../types/context";
import { toggleAnonymous } from "../../services/userService";
import { upsertUser } from "../../services/userService";

/**
 * /anonymous command handler.
 *
 * Toggles the user's anonymous mode setting and confirms the new state.
 */
export async function anonymousCommand(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;

  // Make sure the user record exists before toggling
  await upsertUser(ctx.from);

  const updated = await toggleAnonymous(ctx.from.id);

  if (updated.isAnonymous) {
    await ctx.reply(
      [
        `<b>Anonymous mode is now ON</b>`,
        ``,
        `Your feedback will be sent anonymously. The team will see`,
        `<code>ANON-XXXXX</code> instead of your name or profile.`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  } else {
    await ctx.reply(
      [
        `<b>Anonymous mode is now OFF</b>`,
        ``,
        `Your feedback will include your name and profile link`,
        `so the team knows who sent it.`,
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  }
}
