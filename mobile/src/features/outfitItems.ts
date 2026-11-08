import type { OutfitItem } from "../types/domain.ts";

export const itemKey = (item: OutfitItem) => `${item.source}:${item.garmentId}`;
export const itemReferences = (items: OutfitItem[]) => items.map(({ source, garmentId }) => ({ source, garmentId }));
export function itemError(items: OutfitItem[]) {
  if (items.length < 2 || items.length > 100) return "Select between 2 and 100 pieces.";
  if (new Set(items.map(itemKey)).size !== items.length) return "Each piece can only appear once.";
  return "";
}
export function toggleItem(items: OutfitItem[], item: OutfitItem) {
  return items.some((selected) => itemKey(selected) === itemKey(item))
    ? items.filter((selected) => itemKey(selected) !== itemKey(item))
    : [...items, item];
}
export const itemRoute = (item: OutfitItem) => `/${item.source}/${encodeURIComponent(item.garmentId)}`;
