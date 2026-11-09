import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme/tokens";
type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
};
export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
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
        pressed && styles.pressed,
        blocked && styles.disabled,
      ]}
    >
      {loading && (
        <ActivityIndicator
          color={variant === "secondary" ? colors.ink : "#fff"}
        />
      )}
      <Text
        style={[styles.label, variant === "secondary" && styles.secondaryLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#171717",
    borderRadius: 4,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    flexDirection: "row",
    gap: 10,
  },
  label: { color: "#fff", fontSize: 14, fontWeight: "600", letterSpacing: 0.5 },
  secondary: { backgroundColor: "transparent", borderColor: colors.ink },
  secondaryLabel: { color: colors.ink },
  danger: { backgroundColor: colors.error, borderColor: colors.error },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
