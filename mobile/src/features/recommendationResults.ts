import type { Page, Recommendation } from "../types/domain.ts";
export function recommendationResults(value: Page<Recommendation>) {
  if (!value || !Array.isArray(value.items) || value.nextCursor !== null) throw new Error("Unexpected recommendation response.");
  for (const item of value.items) {
    if (!item.id || !Array.isArray(item.items) || item.items.length!==2 || !Array.isArray(item.reasons) || !item.reasons.length ||
        !Number.isInteger(item.score) || item.score<0 || item.score>100 || item.engineVersion!=="rules-v1" ||
        item.items.some(piece=>!['wardrobe','catalog'].includes(piece.source) || !piece.garmentId || !piece.name))
      throw new Error("Unexpected recommendation details.");
  }
  return value.items;
}
