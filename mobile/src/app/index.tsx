import { useState } from "react";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { apiRequest, isApiConfigured } from "../services/api/client";
import { FramedImage } from "../components/FramedImage";
import { colors, typography } from "../theme/tokens";

const reviewOnly = process.env.EXPO_PUBLIC_REVIEW_ONLY === "true";
const stories = [
  { number: "01", title: "The wardrobe", text: "Bring the pieces you already own into one considered collection." },
  { number: "02", title: "The outfit", text: "Put pieces together, save the combinations you love and wear them again." },
  { number: "03", title: "The next look", text: "Find outfit ideas using your wardrobe, the catalog and your preferences." },
];

function ReviewServiceStatus() {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function check() {
    setChecking(true);
    setMessage("");
    try {
      const response = await apiRequest<{ status: string }>("/healthz");
      setMessage(response.status === "ok" ? "The service is reachable." : "The service could not be verified.");
    } catch {
      setMessage("The service may be starting. Give it a moment, then try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.serviceStatus}>
      <Button label="Check service status" variant="secondary" loading={checking} onPress={check} />
      {!!message && <Text role="status" accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
    </View>
  );
}

export default function Introduction() {
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 860 && fontScale <= 1.2;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.masthead}>
          <Text style={styles.brand}>DRAPE &amp; DROP</Text>
          <Link href={reviewOnly ? "/privacy" : "/login"} style={styles.link}>
            {reviewOnly ? "Privacy" : "Sign in"}
          </Link>
        </View>
        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={wide && styles.column}>
            <FramedImage source={require("../../assets/editorial/introduction.png")}
              label="A layered trench coat with tailored trousers and a leather crossbody bag" />
          </View>
          <View style={[styles.heroCopy, wide && styles.column]}>
            <Text style={styles.eyebrow}>THE PERSONAL EDIT / 01</Text>
            <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>
              Make more of what you wear.
            </Text>
            <Text style={styles.body}>A digital wardrobe for the clothes you own and the outfits you’ll reach for again.</Text>
            {reviewOnly ? (
              <Text style={styles.review}>Website preview · Accounts and wardrobe data are unavailable.</Text>
            ) : (
              <Link href="/signup" style={styles.action}>Start your wardrobe  →</Link>
            )}
          </View>
        </View>
        <View style={[styles.stories, wide && styles.storiesWide]}>
          {stories.map(story => (
            <View key={story.number} style={[styles.story, wide && styles.column]}>
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
        {reviewOnly && isApiConfigured() && <ReviewServiceStatus />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 24 },
  masthead: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 16 },
  brand: { fontSize: 19, fontWeight: "700", letterSpacing: 2, color: colors.ink },
  hero: { backgroundColor: colors.editorial },
  heroWide: { flexDirection: "row", alignItems: "center" },
  column: { flex: 1, minWidth: 0 },
  heroCopy: { gap: 20, padding: 24, paddingBottom: 32 },
  eyebrow: { color: colors.sage, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { ...typography.editorial, fontSize: 40, lineHeight: 44 },
  titleWide: { fontSize: 60, lineHeight: 65 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 25, maxWidth: 420 },
  review: { color: colors.ink, fontSize: 14, lineHeight: 21, borderTopWidth: 1, borderColor: colors.border, paddingTop: 14 },
  action: { alignSelf: "flex-start", backgroundColor: colors.ink, color: colors.surface, fontWeight: "600", padding: 16, minHeight: 52 },
  link: { color: colors.ink, textDecorationLine: "underline", paddingVertical: 14, minHeight: 48 },
  stories: { gap: 20, paddingVertical: 32 },
  storiesWide: { flexDirection: "row", gap: 24 },
  story: { borderTopWidth: 1, borderColor: colors.border, gap: 10, paddingTop: 16 },
  storyTitle: { ...typography.editorial, fontSize: 28 },
  serviceStatus: { alignItems: "flex-start", gap: 8, marginTop: 16 },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 },
});
