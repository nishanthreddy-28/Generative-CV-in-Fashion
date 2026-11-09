export type Field = {
  key: string;
  label: string;
  required?: boolean;
  kind?: "email" | "password" | "number" | "multiline";
  min?: number;
  max?: number;
  decimals?: number;
  options?: string[];
  hint?: string;
  passwordPurpose?: "new" | "current";
};
export function validate(fields: Field[], values: Record<string, string>) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const value = values[f.key] ?? "";
    if (f.required && !value.trim()) {
      errors[f.key] = `${f.label} is required.`;
      continue;
    }
    if (!value.trim()) continue;
    if (value.length > (f.kind === "multiline" ? 2000 : 200)) {
      errors[f.key] = "This entry is too long.";
      continue;
    }
    if (f.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      errors[f.key] = "Enter a valid email address.";
    if (f.kind === "password" && value.length < 8)
      errors[f.key] = "Use at least 8 characters.";
    if (f.kind === "number") {
      const n = Number(value);
      if (
        !Number.isFinite(n) ||
        (f.min !== undefined && n < f.min) ||
        (f.max !== undefined && n > f.max)
      )
        errors[f.key] =
          `Enter a number${f.min !== undefined ? ` from ${f.min}` : ""}${f.max !== undefined ? ` to ${f.max}` : ""}.`;
    }
    if (f.kind === "number" && f.decimals !== undefined && Number.isFinite(Number(value)) &&
        Number(Number(value).toFixed(f.decimals)) !== Number(value))
      errors[f.key] = `Use at most ${f.decimals} decimal places.`;
    if (f.options && !f.options.includes(value))
      errors[f.key] = "Choose an available option.";
  }
  return errors;
}
export function payloadFor(fields: Field[], values: Record<string, string>) {
  return Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.kind === "number"
        ? values[f.key]?.trim()
          ? Number(values[f.key])
          : null
        : (values[f.key] ?? "").trim(),
    ]),
  );
}
