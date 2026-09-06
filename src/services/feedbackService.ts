import { Feedback, FeedbackStatus, MediaType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { nanoid } from "../utils/nanoid";

export type CreateFeedbackInput = {
  userId: number;       // DB user.id (not telegramId)
  content?: string;
  mediaType?: MediaType;
  mediaFileId?: string;
  categoryId?: number;  // Optional FK — null means "General"
  isAnonymous: boolean;
};

/**
 * Persist a new feedback record and increment the user's feedback counter.
 * A random session alias is generated for anonymous display.
 */
export async function saveFeedback(
  input: CreateFeedbackInput
): Promise<Feedback> {
  const sessionAlias = `ANON-${nanoid(5).toUpperCase()}`;

  const [feedback] = await prisma.$transaction([
    prisma.feedback.create({
      data: {
        userId: input.userId,
        sessionAlias,
        content: input.content ?? null,
        mediaType: input.mediaType ?? null,
        mediaFileId: input.mediaFileId ?? null,
        categoryId: input.categoryId ?? null,
        isAnonymous: input.isAnonymous,
        status: "PENDING",
      },
    }),
    prisma.user.update({
      where: { id: input.userId },
      data: {
        feedbackCount: { increment: 1 },
        lastFeedbackAt: new Date(),
      },
    }),
  ]);

  return feedback;
}

/**
 * Store the admin chat message ID after forwarding feedback.
 * This enables admin replies to be routed back to the original sender.
 */
export async function linkAdminMessage(
  feedbackId: number,
  adminMessageId: number
): Promise<void> {
  await prisma.feedback.update({
    where: { id: feedbackId },
    data: { adminMessageId: BigInt(adminMessageId) },
  });
}

/**
 * Look up feedback by the admin chat message ID.
 * Used to identify the original sender when an admin replies.
 */
export async function getFeedbackByAdminMessageId(
  adminMessageId: number
): Promise<
  | (Feedback & {
      user: { telegramId: bigint; firstName: string };
      category: { name: string } | null;
    })
  | null
> {
  return prisma.feedback.findUnique({
    where: { adminMessageId: BigInt(adminMessageId) },
    include: {
      user: { select: { telegramId: true, firstName: true } },
      category: { select: { name: true } },
    },
  });
}

/**
 * Update the status of a feedback item (e.g., mark as REVIEWED).
 */
export async function updateFeedbackStatus(
  feedbackId: number,
  status: FeedbackStatus
): Promise<void> {
  await prisma.feedback.update({
    where: { id: feedbackId },
    data: { status },
  });
}

/**
 * Returns aggregated statistics for the /stats admin command.
 */
export async function getFeedbackStats(): Promise<{
  total: number;
  pending: number;
  reviewed: number;
  archived: number;
  anonymous: number;
  uniqueUsers: number;
  byCategory: { name: string; count: number }[];
}> {
  const [total, pending, reviewed, archived, anonymous, uniqueUsers, byCategory] =
    await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.count({ where: { status: "PENDING" } }),
      prisma.feedback.count({ where: { status: "REVIEWED" } }),
      prisma.feedback.count({ where: { status: "ARCHIVED" } }),
      prisma.feedback.count({ where: { isAnonymous: true } }),
      prisma.feedback
        .findMany({ select: { userId: true }, distinct: ["userId"] })
        .then((r) => r.length),
      // Group by category name; null categoryId = "General"
      prisma.feedback.groupBy({
        by: ["categoryId"],
        _count: { categoryId: true },
      }),
    ]);

  // Resolve category names from IDs
  const categoryIds = byCategory
    .map((r) => r.categoryId)
    .filter((id): id is number => id !== null);

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const byCategoryResolved = byCategory.map((r) => ({
    name: r.categoryId ? (categoryMap.get(r.categoryId) ?? "Unknown") : "General",
    count: r._count.categoryId,
  }));

  return {
    total,
    pending,
    reviewed,
    archived,
    anonymous,
    uniqueUsers,
    byCategory: byCategoryResolved,
  };
}
