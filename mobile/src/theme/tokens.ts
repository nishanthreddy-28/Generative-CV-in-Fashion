export const colors = {
  canvas: "#EDEAE4",
  background: "#FAF8F4",
  surface: "#FFFFFF",
  editorial: "#F0ECE5",
  raised: "#F5F1EB",
  ink: "#171614",
  muted: "#625E58",
  accent: "#292521",
  onAccent: "#FFFFFF",
  sage: "#4E614E",
  border: "#DEDAD3",
  inputBorder: "#888178",
  error: "#923B31",
  errorSurface: "#FBECE9",
  selected: "#EEE9E1",
  scrim: "rgba(0,0,0,0.72)",
} as const;

export const typography = {
  editorial: { fontFamily: "serif", color: colors.ink },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 2.3, color: colors.accent },
} as const;

export const space = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
