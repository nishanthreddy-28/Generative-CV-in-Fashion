import {useWardrobePages} from "../hooks/useWardrobePages";
import {AppIcon} from "../components/AppIcon";
import { colors } from "../theme/tokens";
import {useCallback} from "react";
import {Link,useFocusEffect} from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
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
import { readPage } from "../services/api/readResponse";
import { categories } from "./schema";
import type { Garment, Outfit, Page } from "../types/domain";
type Props = {
  kind: "wardrobe" | "catalog" | "outfits" | "admin";
  title: string;
  subtitle: string;
};
export function CollectionScreen({ kind, title, subtitle }: Props) {
  const preview = usePreview();
  const {width}=useWindowDimensions();
  const columns=collectionColumns(width);
  const [search, setSearch] = useDraft(`${kind}:collection:search`,"");
  const [applied, setApplied] = useDraft(`${kind}:collection:applied`,"");
  const [category, setCategory] = useDraft(`${kind}:collection:category`,"");
  const [sort, setSort] = useDraft(`${kind}:collection:sort`,"newest");
  const [cursor, setCursor] = useDraft(`${kind}:collection:cursor`,"");
  const [pageCount,setPageCount]=useDraft("wardrobe:collection:page-count",1);
  const wardrobe=kind==="wardrobe";
  function resetPages(){setCursor("");if(wardrobe)setPageCount(1);}
  const base = kind === "admin" ? "/admin/catalog" : `/${kind}`;
  const params = new URLSearchParams({
    search: applied,
    category,
    sort,
    limit: wardrobe?"8":"24",
    ...(!wardrobe && cursor ? { cursor } : {}),
  });
  const uncached = useResource<Page<Garment | Outfit>>(
    `${base}?${params}`,
    preview||wardrobe,
    kind === "admin",
    undefined,
    readPage,
  );
  const pages=useWardrobePages(base+"?"+params,pageCount,wardrobe&&!preview);
  const result=wardrobe?pages:uncached;
  const refresh=uncached.retry;
  useFocusEffect(useCallback(()=>{if(!wardrobe)refresh();},[refresh,wardrobe]));
  const list = result.data?.items ?? [];
  return (
    <Screen title={title} subtitle={kind === "wardrobe" ? undefined : subtitle}
      action={kind === "wardrobe" ? <Link href="/outfits" accessibilityLabel="Your saved outfits and generated looks" asChild><Pressable style={styles.outfitsShortcut}><AppIcon name="outfits" size={20}/>{width>=380&&<Text style={styles.shortcutLabel}>Outfits</Text>}</Pressable></Link> : undefined}>
      <Gate preview={preview} admin={kind === "admin"}>
        {kind === "admin" && <Link href="/admin/catalog/new" style={ui.primaryLink}>+ Add catalog item</Link>}
        {kind === "outfits" && <Link href="/outfits/new" style={ui.primaryLink}>+ Create outfit</Link>}
        <View style={ui.field}>
          <View style={[ui.row,{flexWrap:"nowrap"}]}>
          <TextInput
            accessibilityLabel="Search collection"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.muted} placeholder="Search by name or brand"
            returnKeyType="search"
            onSubmitEditing={()=>{setApplied(search.trim());resetPages();}}
            style={[ui.input,styles.search]}
          />
          <Button
            label="Search"
            variant="secondary"
            onPress={() => {
              setApplied(search.trim());
              resetPages();
            }}
          />
          </View>
        </View>
        {kind !== "outfits" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {["All", ...categories].map((c) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`Category: ${c}`}
                accessibilityState={{ checked: (category || "All") === c }}
                key={c}
                style={[styles.filter, (category || "All") === c && styles.activeFilter]}
                onPress={() => {
                  setCategory(c === "All" ? "" : c);
                  resetPages();
                }}
              >
                <Text style={[ui.chipLabel,(category || "All") === c && styles.activeLabel]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
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
                resetPages();
              }}
              style={[ui.chip, sort === v && ui.selected]}
            >
              <Text style={ui.chipLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <ResourceState {...result} loading={result.loading&&(!wardrobe||!result.data)} />
        {result.data && list.length === 0 && (
          <Notice
            title={applied || category ? "No matching pieces" : kind === "wardrobe" ? "Your wardrobe is empty" : kind === "outfits" ? "No saved outfits" : "No catalog items yet"}
            text={applied || category ? "Try another search or clear your filters." : kind === "wardrobe"
              ? "Add a photo of a garment to start your collection."
              : kind === "outfits" ? "Create an outfit to keep it here." : "Pieces will appear here when they’re added to the catalog."}
          >{kind === "wardrobe" && !applied && !category && <RouteLink to="/wardrobe/add">Add your first piece ›</RouteLink>}</Notice>
        )}
        <View style={{flexDirection:"row",flexWrap:"wrap",alignItems:"flex-start",gap:12}}>
        {list.map(item=><View key={item.id} style={{flexBasis: columns === 2 ? "48%" : "100%", flexGrow: columns === 2 ? 1 : 0, maxWidth: columns === 2 ? "50%" : "100%"}}>
          {"category" in item ? <GarmentCard item={item} source={kind==="admin" ? "admin/catalog" : kind==="catalog" ? "catalog" : "wardrobe"}/> :
           <View style={ui.card}><Text style={ui.heading}>{item.name}</Text><RouteLink to={`/outfits/${encodeURIComponent(item.id)}`}>View outfit →</RouteLink></View>}
        </View>)}
        </View>
        {Boolean(result.data?.nextCursor) && (
          <Button
            label={wardrobe?"Show more":"Next page"}
            loading={wardrobe&&result.loading}
            disabled={result.loading||!!result.error}
            variant="secondary"
            onPress={() => wardrobe?setPageCount(pageCount+1):setCursor(result.data!.nextCursor!)}
          />
        )}
        {!wardrobe && Boolean(cursor) && (
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
              resetPages();
            }}
          />
        )}
      </Gate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  outfitsShortcut:{minHeight:44,minWidth:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,paddingHorizontal:12,borderRadius:22,backgroundColor:colors.selected},
  shortcutLabel:{fontSize:13,fontWeight:"600",color:colors.ink},
  search:{flex:1,minWidth:0,borderRadius:24,backgroundColor:colors.raised,paddingHorizontal:16},
  filters:{gap:7,paddingVertical:2},
  filter:{minHeight:44,borderRadius:22,justifyContent:"center",paddingHorizontal:14,backgroundColor:colors.raised},
  activeFilter:{backgroundColor:colors.ink},
  activeLabel:{color:colors.surface},
});
