import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Notice, ResourceState, RouteLink, ui } from "../components/Screen";
import { useResource } from "../hooks/useResource";
import type { Garment, OutfitItem, Page } from "../types/domain";
import { itemKey, itemRoute, toggleItem } from "./outfitItems";

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
    <Text style={ui.heading}>Choose your pieces · {items.length} selected</Text>
    <Text style={ui.body}>Select 2–100 wardrobe or catalog pieces. Save the selection to apply changes.</Text>
    <View style={ui.row}>
      {(["wardrobe", "catalog"] as const).map((value) => <Button key={value} label={value === "wardrobe" ? "Your wardrobe" : "Shared catalog"}
        variant={source === value ? "primary" : "secondary"} disabled={disabled}
        onPress={() => { setSource(value); setCursor(""); }} />)}
    </View>
    <ResourceState {...result} />
    {(result.data?.items ?? []).map((garment) => {
      const item: OutfitItem = { source, garmentId: garment.id };
      const checked = items.some((selected) => itemKey(selected) === itemKey(item));
      return <Pressable key={itemKey(item)} accessibilityRole="checkbox" accessibilityLabel={`${source}: ${garment.name}`}
        accessibilityState={{ checked, disabled }} disabled={disabled || (!checked && items.length >= 100)}
        onPress={() => onChange(toggleItem(items, item))} style={[ui.chip, checked && ui.selected]}>
        <Text>{garment.name} · {garment.category}</Text>
      </Pressable>;
    })}
    {!result.loading && !result.error && !result.data?.items.length &&
      <Notice title="No pieces available" text={preview ? "Preview contains no example garments." : `No ${source} pieces are available. Try the other source or add wardrobe garments.`} />}
    {Boolean(result.data?.nextCursor) && <Button label="Next page of pieces" variant="secondary" disabled={disabled || result.loading}
      onPress={() => setCursor(result.data!.nextCursor!)} />}
    {Boolean(cursor) && <Button label="First page of pieces" variant="secondary" disabled={disabled}
      onPress={() => setCursor("")} />}
    <Text style={ui.heading}>Selected pieces</Text>
    {items.length === 0 && <Notice title="No selected pieces" text="Choose at least two pieces before saving." />}
    {items.map((item, index) => <View key={itemKey(item)} style={ui.card}>
      <RouteLink to={itemRoute(item)} preview={preview}>View {item.source} piece →</RouteLink>
      <Text style={ui.body}>{item.source === source ? result.data?.items.find((garment) => garment.id === item.garmentId)?.name ?? `Selected piece ${index + 1}` : `Selected piece ${index + 1}`}</Text>
      <Button label={`Remove ${item.source} piece`} variant="secondary" disabled={disabled}
        onPress={() => onChange(items.filter((selected) => itemKey(selected) !== itemKey(item)))} />
    </View>)}
  </>;
}
