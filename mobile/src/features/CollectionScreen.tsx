import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import {
  Screen,
  Gate,
  Notice,
  ResourceState,
  RouteLink,
  usePreview,
  ui,
} from "../components/Screen";
import { Button } from "../components/Button";
import { WardrobeImage } from "../components/WardrobeImage";
import { useResource } from "../hooks/useResource";
import { categories } from "./schema";
import type { Garment, Outfit, Page } from "../types/domain";
type Props = {
  kind: "wardrobe" | "catalog" | "outfits" | "admin";
  title: string;
  subtitle: string;
};
export function CollectionScreen({ kind, title, subtitle }: Props) {
  const preview = usePreview();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [cursor, setCursor] = useState("");
  const base = kind === "admin" ? "/admin/catalog" : `/${kind}`;
  const params = new URLSearchParams({
    search: applied,
    category,
    sort,
    limit: "24",
    ...(cursor ? { cursor } : {}),
  });
  const result = useResource<Page<Garment | Outfit>>(
    `${base}?${params}`,
    preview,
    kind === "admin",
  );
  const list = result.data?.items ?? [];
  return (
    <Screen title={title} subtitle={subtitle}>
      <Gate preview={preview} admin={kind === "admin"}>
        {(kind === "wardrobe" || kind === "admin" || kind === "outfits") && (
          <RouteLink
            to={
              kind === "wardrobe"
                ? "/wardrobe/add"
                : kind === "admin"
                  ? "/admin/catalog/new"
                  : "/outfits/new"
            }
            preview={preview}
          >
            {kind === "outfits" ? "Create an outfit" : "Add a garment"} →
          </RouteLink>
        )}
        <View style={ui.field}>
          <Text style={ui.label}>
            Search {kind === "outfits" ? "outfits" : "garments"}
          </Text>
          <TextInput
            accessibilityLabel="Search collection"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or brand"
            style={ui.input}
          />
          <Button
            label="Search"
            variant="secondary"
            onPress={() => {
              setApplied(search.trim());
              setCursor("");
            }}
          />
        </View>
        {kind !== "outfits" && (
          <View style={ui.row}>
            {["All", ...categories].map((c) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`Category: ${c}`}
                accessibilityState={{ checked: (category || "All") === c }}
                key={c}
                style={[ui.chip, (category || "All") === c && ui.selected]}
                onPress={() => {
                  setCategory(c === "All" ? "" : c);
                  setCursor("");
                }}
              >
                <Text>{c}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={ui.row}>
          {[
            ["newest", "Newest"],
            ["name", "Name A–Z"],
          ].map(([v, label]) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`Sort: ${label}`}
              accessibilityState={{ checked: sort === v }}
              key={v}
              onPress={() => {
                setSort(v);
                setCursor("");
              }}
              style={[ui.chip, sort === v && ui.selected]}
            >
              <Text>{label}</Text>
            </Pressable>
          ))}
        </View>
        <ResourceState {...result} />
        {!result.loading && !result.error && list.length === 0 && (
          <Notice
            title={
              applied || category
                ? "No matching pieces"
                : "Your collection starts here"
            }
            text={
              preview
                ? "No example records are supplied in preview. Your real collection will appear after sign-in and backend connection."
                : applied || category
                  ? "Try a different search or category."
                  : "There are no pieces in this collection yet."
            }
          />
        )}
        {list.map((item) => (
          <View key={item.id} style={ui.card}>
            {Boolean(item.imageUrl) && kind === "wardrobe" && (
              <WardrobeImage id={item.id} label={item.name} preview={preview} />
            )}
            {Boolean(item.imageUrl) && kind !== "wardrobe" && (
              <Image
                source={{ uri: item.imageUrl }}
                accessibilityLabel={item.name}
                style={ui.image}
              />
            )}
            <Text style={ui.heading}>{item.name}</Text>
            {"category" in item && (
              <Text style={ui.body}>
                {[item.category, item.color, item.brand]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
            {"description" in item && Boolean(item.description) && (
              <Text style={ui.body}>{item.description}</Text>
            )}
            <RouteLink to={`${base}/${encodeURIComponent(item.id)}`}>
              {kind === "admin" ? "Manage garment" : "View details"} →
            </RouteLink>
          </View>
        ))}
        {preview && (kind === "wardrobe" || kind === "admin") && (
          <RouteLink to={`${base}/review`} preview>
            Review edit & delete form (no record)
          </RouteLink>
        )}
        {Boolean(result.data?.nextCursor) && (
          <Button
            label="Next page"
            disabled={result.loading}
            variant="secondary"
            onPress={() => setCursor(result.data!.nextCursor!)}
          />
        )}
        {Boolean(cursor) && (
          <Button
            label="Back to first page"
            variant="secondary"
            onPress={() => setCursor("")}
          />
        )}
        {Boolean(applied || category) && (
          <Button
            label="Clear filters"
            variant="secondary"
            onPress={() => {
              setSearch("");
              setApplied("");
              setCategory("");
              setCursor("");
            }}
          />
        )}
        <RouteLink to="/dashboard" preview={preview}>
          Back to your dashboard
        </RouteLink>
      </Gate>
    </Screen>
  );
}
