import { Text } from "react-native";
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
    <Screen title={result.data?.name ?? "The garment detail."}>
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
            <Text style={ui.body}>
              {[
                result.data.color,
                result.data.material,
                result.data.brand,
                result.data.size,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {result.data.price != null && (
              <Text style={ui.body}>
                INR {result.data.price.toLocaleString("en-IN")}
              </Text>
            )}
            {Boolean(result.data.notes) && (
              <Text style={ui.body}>{result.data.notes}</Text>
            )}
            <RouteLink
              to={`/try-on?garmentId=${encodeURIComponent(result.data.id)}&source=catalog`}
            >
              Try this piece →
            </RouteLink>
          </>
        )}
        <RouteLink to="/catalog" preview={preview}>
          Back to catalog
        </RouteLink>
      </Gate>
    </Screen>
  );
}
