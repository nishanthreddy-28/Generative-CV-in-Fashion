import { useState } from "react";
import { Text, View } from "react-native";
import { useResource } from "../hooks/useResource";
import { useSession } from "./session";
import { PhotoField, appendPhoto, type Photo } from "../components/PhotoField";
import { WardrobeImage } from "../components/WardrobeImage";
import { Button } from "../components/Button";
import { Notice, ResourceState, ui } from "../components/Screen";
type Item = { id: string; primary: boolean; createdAt: string };
function readGallery(value: Item[]): Item[] {
  if (!Array.isArray(value) || value.length > 8 || value.some(item =>
      !item || typeof item.id !== "string" || typeof item.primary !== "boolean" || typeof item.createdAt !== "string")) {
    throw new Error("The photo list could not be loaded. Try again.");
  }
  return value;
}
export function GarmentGallery({ id, preview }: { id: string; preview: boolean }) {
  const path = `/wardrobe/${encodeURIComponent(id)}/photos`;
  const photos = useResource<Item[]>(path, preview, false, undefined, readGallery);
  const { request } = useSession();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function mutate(method: "POST" | "PUT" | "DELETE", suffix = "", body?: FormData) {
    if (busy || preview) return;
    setBusy(true); setMessage("");
    try { await request(path + suffix, { method, body }); setMessage("Photo changes saved."); setPhoto(null); photos.retry(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save photo changes."); }
    finally { setBusy(false); }
  }
  function upload() {
    if (!photo) return;
    const body = new FormData(); body.append("metadata", "{}"); appendPhoto(body, "image", photo);
    void mutate("POST", "", body);
  }
  return <View style={ui.card}>
    <Text style={ui.heading}>Photos of this piece</Text>
    <Text style={ui.body}>Keep up to eight views. Choose one as the cover photo.</Text>
    <ResourceState {...photos} />
    {photos.data?.map(item => <View key={item.id} style={{ gap: 8 }}>
      <WardrobeImage id={id} photoId={item.id} label="Garment detail" preview={preview} />
      <Text style={ui.body}>{item.primary ? "Cover photo" : "Detail photo"}</Text>
      {!item.primary && <>
        <Button label="Use as cover" disabled={busy} onPress={() => void mutate("PUT", `/${item.id}/primary`)} />
        <Button label="Remove detail photo" variant="secondary" disabled={busy} onPress={() => void mutate("DELETE", `/${item.id}`)} />
      </>}
    </View>)}
    {!photos.error && photos.data && photos.data.length < 8 && <>
      <PhotoField label="Add another view" value={photo} onChange={setPhoto} disabled={busy} camera />
      <Button label="Save additional photo" disabled={busy || !photo} onPress={upload} loading={busy} />
    </>}
    {!!message && <Notice title="Photo status" text={message} />}
  </View>;
}
