import {FramedImage} from "../components/FramedImage";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { colors } from "../theme/tokens";
export default function Introduction() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.wordmark}>DRAPE & DROP</Text>
          <Text style={styles.edition}>THE PERSONAL EDIT</Text>
        </View>
        <FramedImage
          source={require("../../assets/editorial/introduction.png")}
          ratio={1}
          contain
          label="Fashion editorial introducing Drape and Drop"
        />
        <Text style={styles.eyebrow}>LESS GUESSWORK. MORE YOU.</Text>
        <Text accessibilityRole="header" style={styles.title}>
          A wardrobe that{"\n"}works for you.
        </Text>
        <Text style={styles.body}>
          Discover your personal style, bring your wardrobe together, and make
          room for outfits you love.
        </Text>
        <View style={styles.features}>
          <Text style={styles.feature}>YOUR WARDROBE</Text>
          <Text style={styles.feature}>YOUR STYLE</Text>
          <Text style={styles.feature}>YOUR WAY</Text>
        </View>
        {process.env.EXPO_PUBLIC_REVIEW_ONLY === "true" ? (
          <Text style={styles.body}>Website preview · Accounts and wardrobe data are unavailable.</Text>
        ) : (
          <Button label="Get started  →" onPress={() => router.push("/login")} />
        )}
        <Text style={styles.note}>
          A little intention. A lot more possibility.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    gap: 20,
    maxWidth: 540,
    width: "100%",
    alignSelf: "center",
  },
  brand: { alignItems: "center", gap: 8, paddingVertical: 12 },
  wordmark: { fontSize: 20, letterSpacing: 4, color: colors.ink },
  edition: { fontSize: 9, letterSpacing: 3, color: colors.muted },
  image: {
    width: "100%",
    aspectRatio: 0.95,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: colors.sage, marginTop: 8 },
  title: {
    fontSize: 42,
    lineHeight: 47,
    fontFamily: "serif",
    color: colors.ink,
  },
  body: { fontSize: 16, lineHeight: 25, color: colors.muted },
  features: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  feature: { fontSize: 9, letterSpacing: 1, color: colors.sage },
  note: {
    fontSize: 12,
    textAlign: "center",
    color: colors.muted,
    paddingBottom: 12,
  },
});
