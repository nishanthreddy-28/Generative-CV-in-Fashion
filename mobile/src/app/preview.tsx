import { StyleSheet, Text, View } from "react-native";
import { Link, type Href } from "expo-router";
import { colors } from "../theme/tokens";
import { Screen, RouteLink, Notice, ui } from "../components/Screen";
const flows = [
  {
    title: "01 · Your account",
    links: [
      ["Sign in", "/login"],
      ["Create account", "/signup"],
      ["Request password reset", "/forgot-password"],
      ["Set new password", "/reset-password"],
    ],
  },
  {
    title: "02 · Your personal space",
    links: [
      ["Dashboard", "/dashboard"],
      ["Personal profile", "/profile"],
      ["Body & fit profile", "/profile/body"],
    ],
  },
  {
    title: "03 · Your wardrobe",
    links: [
      ["Wardrobe & search", "/wardrobe"],
      ["Upload a garment", "/wardrobe/add"],
      ["Clothing catalog", "/catalog"],
      ["Saved outfits", "/outfits"],
      ["Create an outfit", "/outfits/new"],
      ["Edit outfit form (no record)", "/outfits/review"],
      ["Catalog detail (no record)", "/catalog/review"],
    ],
  },
  {
    title: "04 · Discover your style",
    links: [
      ["Outfit recommendations", "/recommendations"],
      ["Virtual try-on", "/try-on"],
    ],
  },
  {
    title: "05 · Manage your account",
    links: [["Settings & privacy", "/settings"]],
  },
  {
    title: "06 · Administration",
    links: [
      ["Admin overview", "/admin"],
      ["Manage catalog", "/admin/catalog"],
      ["Add catalog garment", "/admin/catalog/new"],
    ],
  },
];
export default function Preview() {
  return (
    <Screen
      title="The workflow edit."
      subtitle="Explore the frontend before connecting your account and data."
    >
      <View style={styles.badgeRow}>
        <Text style={styles.badge}>PREVIEW MODE</Text>
        <Text style={styles.version}>v0.4.1 · Workflow review</Text>
      </View>
      <Notice
        title="Backend not connected"
        text="Review screens, navigation and unsaved forms. Real sign-in, saved records and AI results are not connected. Personal and admin preview links do not grant account access or submit changes."
      />
      {flows.map((flow, index) => (
        <View key={flow.title} style={styles.card}>
          <Text style={ui.heading}>{flow.title}</Text>
          {flow.links.map(([label, to]) => (
            <Link
              key={to}
              href={(index > 0 ? `${to}?preview=1` : to) as Href}
              style={styles.action}
              accessibilityHint={`Open ${label.toLowerCase()}${index > 0 ? " in preview mode" : " form"}`}
            >
              {label} →
            </Link>
          ))}
        </View>
      ))}
      <View style={styles.checkpoint}>
        <Text style={ui.heading}>Today’s checkpoint</Text>
        <Text style={ui.body}>Frontend preview v0.4.1 · Backend security foundation v0.1.0 · Database entity inventory v0.1</Text>
        <Text style={ui.body}>Review only. Database implementation and live integration are still pending.</Text>
      </View>
      <RouteLink to="/">Back to introduction</RouteLink>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  badge: { backgroundColor: colors.ink, color: "#fff", paddingHorizontal: 12, paddingVertical: 8, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  version: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 },
  action: { color: colors.ink, borderWidth: 1, borderColor: colors.border, padding: 16, minHeight: 52, fontSize: 15, fontWeight: "500" },
  checkpoint: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 24, gap: 12 },
});
