import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {WardrobeImage} from "../components/WardrobeImage";
import { Button } from "../components/Button";
import { Notice, ResourceState, RouteLink, ui } from "../components/Screen";
import { useResource } from "../hooks/useResource";
import type { Garment, OutfitItem, Page } from "../types/domain";
import { itemKey, itemRoute, toggleItem } from "./outfitItems";
import { colors } from "../theme/tokens";

type Props = {
  items: OutfitItem[];
  onChange: (items: OutfitItem[]) => void;
  preview: boolean;
  disabled?: boolean;
};
export function OutfitItemSelector({ items, onChange, preview, disabled = false }: Props) {
  const [source, setSource] = useState<"wardrobe" | "catalog">("wardrobe");
  const [cursor, setCursor] = useState("");
  const result = useResource<Page<Garment>>(`/${source}?limit=24${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, preview);
  return <>
    <View style={styles.canvas}>
      <Text style={ui.heading}>Your outfit · {items.length} selected</Text>
      {items.length===0 && <Text style={ui.body}>Choose at least two pieces to build a look.</Text>}
      {items.map((item,index)=><View key={itemKey(item)} style={styles.selectedRow}>
        {index<4 && <View style={styles.thumbnail}>
          <WardrobeImage id={item.garmentId} source={item.source} label={`Selected piece ${index+1}`}/>
        </View>}
        <View style={styles.name}>
        <RouteLink to={itemRoute(item)} preview={preview}>
          {item.source === source ? result.data?.items.find(garment=>garment.id===item.garmentId)?.name ?? `Piece ${index+1}` : `Piece ${index+1}`} ›
        </RouteLink>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove piece ${index+1}`} disabled={disabled}
          onPress={()=>onChange(items.filter(selected=>itemKey(selected)!==itemKey(item)))} style={styles.remove}>
          <Text style={styles.mark}>×</Text>
        </Pressable>
      </View>)}
    </View>
    <Text style={ui.heading}>Choose pieces</Text>
    <View style={ui.row}>
      {(["wardrobe", "catalog"] as const).map((value) => <Button key={value} label={value === "wardrobe" ? "Your wardrobe" : "Shared catalog"}
        variant={source === value ? "primary" : "secondary"} disabled={disabled}
        onPress={() => { setSource(value); setCursor(""); }} />)}
    </View>
    <ResourceState {...result} />
    <View style={styles.grid}>{(result.data?.items ?? []).map((garment) => {
      const item: OutfitItem = { source, garmentId: garment.id };
      const checked = items.some((selected) => itemKey(selected) === itemKey(item));
      return <Pressable key={itemKey(item)} accessibilityRole="checkbox" accessibilityLabel={`${source}: ${garment.name}`}
        accessibilityState={{ checked, disabled }} disabled={disabled || (!checked && items.length >= 100)}
        onPress={() => onChange(toggleItem(items, item))} style={[styles.piece, checked && styles.checked]}>
        <WardrobeImage id={garment.id} label={garment.name} source={source}/>
        <View style={styles.pieceLabel}>
          <Text style={[ui.label,styles.name]} numberOfLines={2}>{garment.name}</Text>
          <Text style={styles.mark}>{checked ? "✓" : "+"}</Text>
        </View>
      </Pressable>;
    })}</View>
    {!result.loading && !result.error && !result.data?.items.length &&
      <Notice title="No pieces available" text={preview ? "Preview contains no example garments." : `No ${source} pieces are available. Try the other source or add wardrobe garments.`} />}
    {Boolean(result.data?.nextCursor) && <Button label="Next page of pieces" variant="secondary" disabled={disabled || result.loading}
      onPress={() => setCursor(result.data!.nextCursor!)} />}
    {Boolean(cursor) && <Button label="First page of pieces" variant="secondary" disabled={disabled}
      onPress={() => setCursor("")} />}
  </>;
}

const styles = StyleSheet.create({
  canvas:{backgroundColor:"#F9E5EE",borderRadius:20,padding:16,gap:6},
  selectedRow:{flexDirection:"row",alignItems:"center",gap:8,borderTopWidth:1,borderColor:colors.border,paddingVertical:4},
  thumbnail:{width:42},
  remove:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:8},
  piece:{flexBasis:"47%",flexGrow:1,maxWidth:"50%",borderRadius:16,overflow:"hidden",borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  checked:{borderColor:colors.ink,backgroundColor:"#FFDBC0"},
  pieceLabel:{padding:8,flexDirection:"row",gap:6,alignItems:"center"},
  name:{flex:1},
  mark:{fontSize:20,color:colors.ink},
});
