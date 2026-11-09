import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { atelier } from "../theme/atelier";
import { colors } from "../theme/tokens";
type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  dark?: boolean;
  variant?: "primary" | "secondary" | "danger";
};
export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  dark = false,
  variant = "primary",
}: Props) {
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        dark && {backgroundColor:atelier.accent,borderColor:atelier.accent},
        pressed && styles.pressed,
        blocked && styles.disabled,
      ]}
    >
      {loading && (
        <ActivityIndicator
          color={dark ? atelier.onAccent : variant === "secondary" ? colors.ink : colors.onAccent}
        />
      )}
      <Text
        style={[styles.label, variant === "secondary" && styles.secondaryLabel,dark && {color:atelier.onAccent}]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    padding: 13,
    flexDirection: "row",
    gap: 10,
  },
  label: { color: colors.onAccent, fontSize: 14, fontWeight: "600", letterSpacing: 0.5 },
  secondary: { backgroundColor: "transparent", borderColor: colors.inputBorder },
  secondaryLabel: { color: colors.ink },
  danger: { backgroundColor: colors.error, borderColor: colors.error },
  pressed: { opacity: 0.82, transform: [{scale: 0.99}] },
  disabled: { opacity: 0.45 },
});
