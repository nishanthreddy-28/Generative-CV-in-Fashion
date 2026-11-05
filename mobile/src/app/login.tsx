import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';
export default function Login() {
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>YOUR NEXT CHAPTER</Text>
    <Text accessibilityRole="header" style={styles.title}>Style starts{ '\n' }with you.</Text>
    <Text style={styles.body}>Sign in will unlock your personal wardrobe, body profile, and saved outfits.</Text>
    <View accessibilityRole="alert" style={styles.notice}>
      <Text style={styles.noticeTitle}>Sign-in is not connected yet</Text>
      <Text style={styles.body}>We are building the mobile experience. Account access will become available when authentication is connected.</Text>
    </View>
    <Text style={styles.footnote}>Your personal features stay behind sign-in.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 48, gap: 24, maxWidth: 540, width: '100%', alignSelf: 'center' },
  eyebrow: { letterSpacing: 2, fontSize: 10, color: colors.sage }, title: { fontFamily: 'serif', fontSize: 44, lineHeight: 50, color: colors.ink },
  body: { fontSize: 16, lineHeight: 26, color: colors.muted }, notice: { padding: 24, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 12 },
  noticeTitle: { fontSize: 18, fontWeight: '600', color: colors.ink }, footnote: { color: colors.muted, fontSize: 13 },
});
