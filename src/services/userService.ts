import { User } from "@prisma/client";
import { prisma } from "../config/prisma";

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

/**
 * Upsert a user record from Telegram context data.
 * Creates a new record on first contact, or updates name/username fields.
 */
export async function upsertUser(telegramUser: TelegramUser): Promise<User> {
  const telegramId = BigInt(telegramUser.id);

  return prisma.user.upsert({
    where: { telegramId },
    update: {
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      username: telegramUser.username ?? null,
    },
    create: {
      telegramId,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      username: telegramUser.username ?? null,
    },
  });
}

/**
 * Toggle the anonymous mode flag for a user.
 * Returns the updated user record.
 */
export async function toggleAnonymous(telegramId: number): Promise<User> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { telegramId: BigInt(telegramId) },
  });

  return prisma.user.update({
    where: { id: user.id },
    data: { isAnonymous: !user.isAnonymous },
  });
}

/**
 * Ban a user by their Telegram ID.
 * Subsequent updates from this user will be silently dropped.
 */
export async function banUser(
  telegramId: number,
  reason?: string
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
  if (!user) return null;

  return prisma.user.update({
    where: { id: user.id },
    data: {
      isBanned: true,
      banReason: reason ?? null,
      bannedAt: new Date(),
    },
  });
}

/**
 * Unban a user by their Telegram ID.
 */
export async function unbanUser(telegramId: number): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
  if (!user) return null;

  return prisma.user.update({
    where: { id: user.id },
    data: { isBanned: false, banReason: null, bannedAt: null },
  });
}

/**
 * Fetch a user by their Telegram ID. Returns null if not found.
 */
export async function getUserByTelegramId(
  telegramId: number
): Promise<User | null> {
  return prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
}
