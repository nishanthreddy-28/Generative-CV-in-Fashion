export type Occasion = "Everyday" | "Work" | "Evening" | "Weekend" | "Special occasion";

export const occasions: Occasion[] = ["Everyday", "Work", "Evening", "Weekend", "Special occasion"];
export const fits = ["Fitted", "Regular", "Relaxed", "Oversized"] as const;

export function parseTags(value: string): string[] | null {
  const tags = value.split(/[\n,]/).map((tag) => tag.trim()).filter(Boolean);
  const unique = new Set(tags.map((tag) => tag.toLocaleLowerCase()));
  return tags.length <= 20 && tags.every((tag) => tag.length <= 40) && unique.size === tags.length
    ? tags
    : null;
}

export function parseBudget(value: string): number | null | undefined {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount <= 1_000_000 ? amount : undefined;
}

export type PersonalizationPatch = {
  styleTags: string[];
  colorTags: string[];
  preferredFit: (typeof fits)[number] | null;
  preferredOccasions: Occasion[];
  budgetMin: number | null;
  budgetMax: number | null;
};

export function buildPersonalizationPatch(values: Record<string, string>, selectedOccasions: Occasion[]): PersonalizationPatch | null {
  const styleTags = parseTags(values.styleTags ?? "");
  const colorTags = parseTags(values.colorTags ?? "");
  const budgetMin = parseBudget(values.budgetMin ?? "");
  const budgetMax = parseBudget(values.budgetMax ?? "");
  if (styleTags === null || colorTags === null || budgetMin === undefined || budgetMax === undefined) return null;
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) return null;
  const preferredFit = values.preferredFit && values.preferredFit !== "No preference"
    ? values.preferredFit as (typeof fits)[number]
    : null;
  if (preferredFit !== null && !fits.includes(preferredFit)) return null;
  return { styleTags, colorTags, preferredFit, preferredOccasions: selectedOccasions, budgetMin, budgetMax };
}
