import type { Field } from "./validation";
export const categories = [
  "Tops",
  "Bottoms",
  "Outerwear",
  "Dresses",
  "Shoes",
  "Accessories",
];
export const profileFields: Field[] = [
  { key: "name", label: "Name", required: true },
  {
    key: "style",
    label: "Style preferences",
    kind: "multiline",
    hint: "Describe the colors, silhouettes, and styles you enjoy.",
  },
  { key: "location", label: "Location" },
  { key: "bio", label: "About you", kind: "multiline" },
];
export const bodyFields: Field[] = [
  {
    key: "units",
    label: "Measurement units",
    required: true,
    options: ["cm", "in"],
  },
  ...["height", "chest", "waist", "hips", "inseam"].map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    kind: "number" as const,
    min: 1,
    max: 300,
  })),
  { key: "bodyShape", label: "Body shape (optional)" },
  { key: "skinTone", label: "Skin tone description (optional)" },
  {
    key: "undertone",
    label: "Undertone (optional)",
    options: ["Warm", "Cool", "Neutral", "Not sure"],
  },
  {
    key: "fit",
    label: "Preferred fit",
    options: ["Fitted", "Regular", "Relaxed", "Oversized"],
  },
];
export const garmentFields: Field[] = [
  { key: "name", label: "Garment name", required: true },
  { key: "category", label: "Category", required: true, options: categories },
  { key: "color", label: "Color" },
  { key: "brand", label: "Brand" },
  { key: "size", label: "Size" },
  { key: "material", label: "Material" },
  { key: "notes", label: "Notes", kind: "multiline" },
];
export const catalogFields: Field[] = [
  ...garmentFields,
  { key: "price", label: "Price (INR)", kind: "number", min: 0, max: 1000000 },
];
export const preferenceFields: Field[] = [
  { key: "units", label: "Measurement units", options: ["cm", "in"] },
  {
    key: "emailNotifications",
    label: "Style emails",
    options: ["Enabled", "Disabled"],
  },
];
