import { Category } from "@prisma/client";
import { prisma } from "../config/prisma";

/**
 * Fetch all active categories ordered by creation date.
 * Returns an empty array when none are configured — this signals
 * the user flow to skip the category picker entirely.
 */
export async function getActiveCategories(): Promise<Category[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Add a new category. The name is trimmed and title-cased.
 * Returns null if a category with that name already exists.
 */
export async function addCategory(rawName: string): Promise<Category | null> {
  const name = rawName.trim();
  if (!name) return null;

  try {
    return await prisma.category.create({ data: { name } });
  } catch {
    // Unique constraint violation — category already exists
    return null;
  }
}

/**
 * Remove a category by name (case-insensitive match).
 * Returns the deleted record, or null if not found.
 */
export async function removeCategory(rawName: string): Promise<Category | null> {
  const name = rawName.trim();

  const found = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (!found) return null;

  return prisma.category.delete({ where: { id: found.id } });
}

/**
 * Find a single active category by ID.
 */
export async function getCategoryById(id: number): Promise<Category | null> {
  return prisma.category.findFirst({ where: { id, isActive: true } });
}
