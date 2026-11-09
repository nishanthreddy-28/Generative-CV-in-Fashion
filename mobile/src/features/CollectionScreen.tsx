import { colors } from "../theme/tokens";
import {useCallback} from "react";
import {Link,useFocusEffect} from "expo-router";
import { Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
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
import {GarmentCard} from "../components/GarmentCard";
import {useDraft} from "../hooks/useDraft";
import {collectionColumns} from "./presentation";
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
  const columns=collectionColumns(useWindowDimensions().width);
  const [search, setSearch] = useDraft(`${kind}:collection:search`,"");
  const [applied, setApplied] = useDraft(`${kind}:collection:applied`,"");
  const [category, setCategory] = useDraft(`${kind}:collection:category`,"");
  const [sort, setSort] = useDraft(`${kind}:collection:sort`,"newest");
  const [cursor, setCursor] = useDraft(`${kind}:collection:cursor`,"");
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
  const refresh=result.retry;
  useFocusEffect(useCallback(()=>{refresh();},[refresh]));
  const list = result.data?.items ?? [];
  return (
    <Screen title={title} subtitle={subtitle}>
      <Gate preview={preview} admin={kind === "admin"}>
        {kind === "wardrobe" && <Link href="/wardrobe/add" style={ui.primaryLink}>+ Add item</Link>}
        {kind === "admin" && <Link href="/admin/catalog/new" style={ui.primaryLink}>+ Add catalog item</Link>}
        {kind === "outfits" && <Link href="/outfits/new" style={ui.primaryLink}>+ Create outfit</Link>}
        <View style={ui.field}>
          <Text style={ui.label}>
            Search {kind === "outfits" ? "outfits" : "garments"}
          </Text>
          <View style={[ui.row,{flexWrap:"nowrap"}]}>
          <TextInput
            accessibilityLabel="Search collection"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.muted} placeholder="Search by name or brand"
            returnKeyType="search"
            onSubmitEditing={()=>{setApplied(search.trim());setCursor("");}}
            style={[ui.input,{flex:1,minWidth:0}]}
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
                <Text style={ui.chipLabel}>{c}</Text>
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
              <Text style={ui.chipLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <ResourceState {...result} />
        {!result.loading && !result.error && list.length === 0 && (
          <Notice
            title={applied || category ? "No matching pieces" : kind === "wardrobe" ? "Your wardrobe is empty" : kind === "outfits" ? "No saved outfits" : "No catalog items yet"}
            text={applied || category ? "Try another search or clear your filters." : kind === "wardrobe"
              ? "Add a photo of a garment to start your collection."
              : kind === "outfits" ? "Create an outfit to keep it here." : "Pieces will appear here when they’re added to the catalog."}
          />
        )}
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:12}}>
        {list.map(item=><View key={item.id} style={{flexBasis: columns === 2 ? "48%" : "100%", flexGrow: columns === 2 ? 1 : 0, maxWidth: columns === 2 ? "50%" : "100%"}}>
          {"category" in item ? <GarmentCard item={item} source={kind==="admin" ? "admin/catalog" : kind==="catalog" ? "catalog" : "wardrobe"}/> :
           <View style={ui.card}><Text style={ui.heading}>{item.name}</Text><RouteLink to={`/outfits/${encodeURIComponent(item.id)}`}>View outfit →</RouteLink></View>}
        </View>)}
        </View>
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
      </Gate>
    </Screen>
  );
}
