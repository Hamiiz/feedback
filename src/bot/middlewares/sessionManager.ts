import { session } from "telegraf";
import { prisma } from "../../config/prisma";
import { BotContext, SessionData, defaultSession } from "../../types/context";

/**
 * Prisma-backed session store for Telegraf.
 *
 * Sessions are keyed by "{chatId}:{userId}" and stored in the `bot_sessions`
 * PostgreSQL table via the BotSession model. This means session state survives
 * bot restarts, unlike the default in-memory store.
 */
export function createSessionMiddleware() {
  return session<SessionData, BotContext>({
    defaultSession,

    store: {
      async get(key: string): Promise<SessionData | undefined> {
        const record = await prisma.botSession.findUnique({ where: { id: key } });
        if (!record) return undefined;
        return record.data as unknown as SessionData;
      },

      async set(key: string, value: SessionData): Promise<void> {
        await prisma.botSession.upsert({
          where: { id: key },
          update: { data: value as object },
          create: { id: key, data: value as object },
        });
      },

      async delete(key: string): Promise<void> {
        await prisma.botSession.deleteMany({ where: { id: key } });
      },
    },
  });
}
