import type { Page } from "../../types/domain.ts";

export function readRecord<T>(value: T): T {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The server returned an unexpected response. Try again.");
  }
  return value;
}

export function readPage<T extends { id: string }>(value: Page<T>): Page<T> {
  if (!value || !Array.isArray(value.items) ||
      value.items.some(item => !item || typeof item.id !== "string" || !item.id) ||
      (value.nextCursor != null && typeof value.nextCursor !== "string")) {
    throw new Error("The server returned an unexpected list. Try again.");
  }
  return value;
}
