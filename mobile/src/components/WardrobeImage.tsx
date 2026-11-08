import { useEffect, useState } from "react";
import { Image, Text } from "react-native";
import { useResource } from "../hooks/useResource";
import { ResourceState, ui } from "./Screen";

// Browser <img> requests cannot attach the API Bearer header. Fetch the bytes with
// the same current-user request helper on both platforms; never use public URLs.
export function WardrobeImage({ id, label, preview = false, source = "wardrobe" }: {
  id: string; label: string; preview?: boolean; source?: "wardrobe" | "catalog" | "admin/catalog";
}) {
  const result = useResource<Blob>(`/${source}/${encodeURIComponent(id)}/image`, preview, source === "admin/catalog", "image");
  const [image, setImage] = useState<{ blob: Blob; uri: string } | null>(null);
  const [failed, setFailed] = useState<Blob | null>(null);
  useEffect(() => {
    if (!result.data) return;
    const blob = result.data;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImage({ blob, uri: reader.result });
      else setFailed(blob);
    };
    reader.onerror = () => setFailed(blob);
    reader.readAsDataURL(blob);
    return () => {
      reader.onload = null;
      reader.onerror = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [result.data]);
  return <>
    <ResourceState {...result} />
    {result.data && image?.blob === result.data &&
      <Image source={{ uri: image.uri }} accessibilityLabel={label} style={ui.image} />}
    {result.data && failed === result.data && <Text style={ui.error}>The garment image could not be displayed.</Text>}
  </>;
}
