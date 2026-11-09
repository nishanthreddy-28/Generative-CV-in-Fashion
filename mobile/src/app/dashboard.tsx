import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { Button } from "../components/Button";
import { Text, View } from "react-native";
import {
  Screen,
  Gate,
  Notice,
  RouteLink,
  ResourceState,
  usePreview,
  ui,
} from "../components/Screen";
import { useResource } from "../hooks/useResource";
import type { Dashboard } from "../types/domain";
export default function DashboardScreen() {
  const preview = usePreview();
  const result = useResource<Dashboard>("/dashboard", preview);
  const refresh=result.retry;
  useFocusEffect(useCallback(()=>{refresh();},[refresh]));
  return (
    <Screen
      title="Your personal edit."
      subtitle="Bring your wardrobe, your fit, and your next outfit together."
    >
      <Gate preview={preview}>
        <Button label="Refresh overview" variant="secondary" onPress={refresh} disabled={result.loading}/>
        <ResourceState {...result} />
        {result.data && (
          <View style={ui.card}>
            <Text style={ui.heading}>
              {result.data.wardrobeCount} wardrobe pieces
            </Text>
            <Text style={ui.body}>
              {result.data.savedOutfitCount} saved outfits ·{" "}
              {result.data.recommendationCount} generated recommendations · {result.data.savedRecommendationCount} saved recommendations · {result.data.tryOnJobCount} try-on jobs
            </Text>
          </View>
        )}
        {result.data && !result.data.wardrobeCount && !result.data.savedOutfitCount && <Notice title="Your collection starts here" text="Add a wardrobe piece or explore the shared catalog."/>}
        {preview && (
          <Notice
            title="Your overview will appear here"
            text="Wardrobe totals and outfit activity are shown only when returned by your account service."
          />
        )}
        {[
          ["Your wardrobe", "/wardrobe"],
          ["Add a garment", "/wardrobe/add"],
          ["Explore the catalog", "/catalog"],
          ["Find an outfit", "/recommendations"],
          ["Virtual try-on", "/try-on"],
          ["Saved outfits", "/outfits"],
          ["Saved recommendations", "/recommendations/saved"],
          ["Personal profile", "/profile"],
          ["Body & fit", "/profile/body"],
          ["Settings", "/settings"],
        ].map(([label, to]) => (
          <RouteLink key={to} to={to} preview={preview}>
            {label} →
          </RouteLink>
        ))}
      </Gate>
    </Screen>
  );
}
