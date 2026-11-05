import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/tokens';
type Props = { label: string; onPress: () => void; disabled?: boolean };
export function Button({ label, onPress, disabled = false }: Props) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { backgroundColor: colors.ink, borderRadius: 8, minHeight: 56, alignItems: 'center', justifyContent: 'center', padding: 16 },
  label: { color: colors.background, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.8 }, disabled: { opacity: 0.45 },
});
