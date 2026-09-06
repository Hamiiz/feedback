import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a cryptographically random alphanumeric string of a given length.
 * Used for creating session aliases (e.g., "ANON-A7F3K").
 */
export function nanoid(size: number = 5): string {
  const bytes = randomBytes(size);
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("");
}
