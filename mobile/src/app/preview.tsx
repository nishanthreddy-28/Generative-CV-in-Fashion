import { Text, View } from "react-native";
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
      <Notice
        title="Interface review only"
        text="These links open empty screens and unsaved forms. Preview never grants account or administrator access, loads personal records, or sends writes to a backend."
      />
      {flows.map((flow, index) => (
        <View key={flow.title} style={ui.card}>
          <Text style={ui.heading}>{flow.title}</Text>
          {flow.links.map(([label, to]) => (
            <RouteLink key={to} to={to} preview={index > 0}>
              {label} →
            </RouteLink>
          ))}
        </View>
      ))}
      <RouteLink to="/">Back to introduction</RouteLink>
    </Screen>
  );
}
