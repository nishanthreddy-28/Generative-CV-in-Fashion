import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Gate,
  Notice,
  ResourceState,
  RouteLink,
  usePreview,
  ui,
} from "../../components/Screen";
import { WardrobeImage } from "../../components/WardrobeImage";
import { useResource } from "../../hooks/useResource";
import type { Garment } from "../../types/domain";
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const preview = usePreview();
  const result = useResource<Garment>(
    `/catalog/${encodeURIComponent(id)}`,
    preview,
  );
  return (
    <Screen title={result.data?.name ?? "Catalog item"}>
      <Gate preview={preview}>
        <ResourceState {...result} />
        {preview && (
          <Notice
            title="No catalog record selected"
            text="Garment imagery and details are rendered only from the catalog API."
          />
        )}
        {result.data && (
          <>
            {Boolean(result.data.imageUrl) && (
              <WardrobeImage id={result.data.id} label={result.data.name} preview={preview} source="catalog" />
            )}
            <Text style={ui.heading}>{result.data.category}</Text>
            <View style={ui.card}>
             <Text style={ui.heading}>The details</Text>
             {[["Brand",result.data.brand],["Colour",result.data.color],["Material",result.data.material],["Size",result.data.size]].filter(([,value])=>Boolean(value)).map(([label,value])=><View key={label} style={{flexDirection:"row",justifyContent:"space-between",gap:16}}><Text style={ui.body}>{label}</Text><Text style={[ui.label,{flexShrink:1,textAlign:"right"}]}>{value}</Text></View>)}
             {![result.data.brand,result.data.color,result.data.material,result.data.size].some(Boolean) && <Text style={ui.body}>Additional details haven’t been supplied for this piece.</Text>}
            </View>
            {result.data.price != null && (
              <Text style={ui.body}>
                INR {result.data.price.toLocaleString("en-IN")}
              </Text>
            )}
            {Boolean(result.data.notes) && (
              <Text style={ui.body}>{result.data.notes}</Text>
            )}
          </>
        )}
        <RouteLink to="/catalog" preview={preview}>
          Back to catalog
        </RouteLink>
      </Gate>
    </Screen>
  );
}
