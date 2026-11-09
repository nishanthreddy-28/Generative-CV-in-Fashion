import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FramedImage } from "../components/FramedImage";
import { colors, typography } from "../theme/tokens";

const stories = [
  { number: "01", title: "The wardrobe", text: "Bring the pieces you already own into one considered collection." },
  { number: "02", title: "The outfit", text: "Put pieces together, save the combinations you love and wear them again." },
  { number: "03", title: "The next look", text: "Find outfit ideas using your wardrobe, the catalog and your preferences." },
];

export default function Introduction() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.masthead}>
          <Text style={styles.brand}>DRAPE &amp; DROP</Text>
          <Link href="/login" style={styles.link}>Sign in</Link>
        </View>
        <View style={styles.hero}>
          <View>
            <FramedImage source={require("../../assets/editorial/introduction.png")}
              label="A layered trench coat with tailored trousers and a leather crossbody bag" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>THE PERSONAL EDIT / 01</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Make more of what you wear.
            </Text>
            <Text style={styles.body}>A digital wardrobe for the clothes you own and the outfits you’ll reach for again.</Text>
            <Link href="/login" style={styles.action}>Sign in  →</Link>
            <Link href="/signup" style={styles.existingAccount}>New here? Create an account</Link>
          </View>
        </View>
        <View style={styles.stories}>
          {stories.map(story => (
            <View key={story.number} style={styles.story}>
              <Text style={styles.eyebrow}>{story.number}</Text>
              <Text accessibilityRole="header" style={styles.storyTitle}>{story.title}</Text>
              <Text style={styles.body}>{story.text}</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={styles.eyebrow}>DRAPE &amp; DROP</Text>
          <Link href="/privacy" style={styles.link}>Privacy &amp; your data</Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { width: "100%", maxWidth: 540, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 24 },
  masthead: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 16 },
  brand: { fontSize: 19, fontWeight: "700", letterSpacing: 2, color: colors.ink },
  hero: { backgroundColor: colors.editorial },
  heroCopy: { gap: 20, padding: 24, paddingBottom: 32 },
  eyebrow: { color: colors.sage, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { ...typography.editorial, fontSize: 36, lineHeight: 41 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 25, maxWidth: 420 },
  action: { textAlign: "center", backgroundColor: colors.ink, color: colors.surface, fontWeight: "600", padding: 16, minHeight: 52 },
  existingAccount: { color: colors.ink, textAlign: "center", paddingVertical: 12, minHeight: 48, textDecorationLine: "underline" },
  link: { color: colors.ink, textDecorationLine: "underline", paddingVertical: 14, minHeight: 48 },
  stories: { gap: 20, paddingVertical: 32 },
  story: { borderTopWidth: 1, borderColor: colors.border, gap: 10, paddingTop: 16 },
  storyTitle: { ...typography.editorial, fontSize: 28 },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 },
});
