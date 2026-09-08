import { prisma } from "../config/prisma";

/**
 * Store the reply-routing map after a feedback notification is forwarded.
 * Maps the admin chat message_id back to the original sender so admin
 * replies can be relayed to the right user.
 *
 * This is the only DB write that happens per feedback submission.
 */
export async function storeReplyMap(
  adminMessageId: number,
  userTelegramId: bigint,
  senderName: string
): Promise<void> {
  await prisma.replyMap.create({
    data: {
      adminMessageId: BigInt(adminMessageId),
      userTelegramId,
      senderName,
    },
  });
}

/**
 * Look up the original sender by the admin chat message_id.
 * Returns null if the message is not a feedback notification.
 */
export async function getSenderByAdminMessageId(
  adminMessageId: number
): Promise<{ userTelegramId: bigint; senderName: string } | null> {
  const record = await prisma.replyMap.findUnique({
    where: { adminMessageId: BigInt(adminMessageId) },
    select: { userTelegramId: true, senderName: true },
  });
  return record ?? null;
}
