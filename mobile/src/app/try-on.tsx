import { useDraft } from "../hooks/useDraft";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Gate,
  Notice,
  RouteLink,
  ResourceState,
  usePreview,
  ui,
} from "../components/Screen";
import { PhotoField, appendPhoto, type Photo } from "../components/PhotoField";
import { Button } from "../components/Button";
import { useResource } from "../hooks/useResource";
import { useSession } from "../features/session";
import type { Garment, Page, TryOnJob } from "../types/domain";
export default function TryOn() {
  const preview = usePreview();
  const params = useLocalSearchParams<{
    garmentId?: string;
    source?: string;
  }>();
  const { session, request } = useSession();
  const [cursor, setCursor] = useState("");
  const wardrobe = useResource<Page<Garment>>(
    `/wardrobe?limit=24${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    preview,
  );
  const catalog = useResource<Garment>(
    `/catalog/${encodeURIComponent(params.garmentId ?? "")}`,
    preview || params.source !== "catalog" || !params.garmentId,
  );
  const [person, setPerson] = useDraft<Photo | null>("try-on:photo", null);
  const [ignoreCatalog, setIgnoreCatalog] = useDraft(
    "try-on:ignoreCatalog",
    false,
  );
  const [choice, setSelected] = useDraft<{
    garment: Garment;
    source: "wardrobe" | "catalog";
  } | null>("try-on:garment", null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [message, setMessage] = useState("");
  const selected =
    choice ??
    (!ignoreCatalog && catalog.data
      ? { garment: catalog.data, source: "catalog" as const }
      : null);
  async function generate() {
    setMessage("");
    if (!person || !selected || !consent) {
      setMessage(
        "Choose your photo, select a garment, and confirm permission to use the photo.",
      );
      return;
    }
    if (preview) {
      setMessage(
        "Preview only. Photos have not been uploaded and no try-on has been generated.",
      );
      return;
    }
    if (!session) return;
    setBusy(true);
    setJob(null);
    try {
      const form = new FormData();
      appendPhoto(form, "person", person);
      form.append("garmentId", selected.garment.id);
      form.append("source", selected.source);
      form.append("photoConsent", "true");
      const value = await request<TryOnJob>("/try-on", {
        method: "POST",
        token: session.accessToken,
        body: form,
      });
      setJob(value);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to start your try-on.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!job || !session) return;
    setBusy(true);
    setMessage("");
    try {
      setJob(
        await request<TryOnJob>(`/try-on/${encodeURIComponent(job.id)}`, {
          token: session.accessToken,
        }),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to check progress.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="See it your way."
      subtitle="Select a wardrobe or catalog piece and a photo of yourself."
    >
      <Gate preview={preview}>
        <PhotoField
          label="Your full-length photo"
          value={person}
          disabled={busy}
          onChange={(p) => {
            setPerson(p);
            setConsent(false);
            setJob(null);
          }}
        />
        <Text style={ui.heading}>Choose a garment</Text>
        <ResourceState {...wardrobe} />
        {params.source === "catalog" && <ResourceState {...catalog} />}
        {selected && (
          <Notice
            title="Selected piece"
            text={`${selected.garment.name} · ${selected.source}`}
          />
        )}
        <View style={ui.row}>
          {(wardrobe.data?.items ?? []).map((g) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`Try on ${g.name}`}
              accessibilityState={{
                checked:
                  selected?.garment.id === g.id &&
                  selected.source === "wardrobe",
              }}
              disabled={busy}
              key={g.id}
              style={[ui.chip, selected?.garment.id === g.id && ui.selected]}
              onPress={() => {
                setSelected({ garment: g, source: "wardrobe" });
                setJob(null);
              }}
            >
              <Text>{g.name}</Text>
            </Pressable>
          ))}
        </View>
        {!wardrobe.loading &&
          !wardrobe.error &&
          !wardrobe.data?.items.length &&
          !selected && (
            <Notice
              title="No garment selected"
              text="Add wardrobe pieces or choose an item from the catalog. Preview does not provide sample garments."
            />
          )}
        {Boolean(wardrobe.data?.nextCursor) && (
          <Button
            label="Next page of garments"
            variant="secondary"
            onPress={() => setCursor(wardrobe.data!.nextCursor!)}
            disabled={busy}
          />
        )}
        {Boolean(cursor) && (
          <Button
            label="First page"
            variant="secondary"
            onPress={() => setCursor("")}
            disabled={busy}
          />
        )}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Photo processing consent"
          disabled={busy}
          style={[ui.chip, consent && ui.selected]}
          onPress={() => setConsent((v) => !v)}
        >
          <Text style={ui.body}>
            {consent ? "☑" : "☐"} I have permission to use this photo and agree
            to submit it for this try-on.
          </Text>
        </Pressable>
        <Button label="Create try-on" onPress={generate} loading={busy} />
        {Boolean(message) && <Notice title="Try-on status" text={message} />}
        {job && (
          <Notice
            title={
              job.status === "completed"
                ? "Your try-on is ready"
                : job.status === "failed"
                  ? "Try-on could not complete"
                  : job.status === "queued"
                    ? "Your try-on is queued"
                    : "Your try-on is processing"
            }
            text={
              job.status === "failed"
                ? (job.error ?? "Try another photo or garment.")
                : job.status === "completed"
                  ? "This image was returned by the try-on service."
                  : "Check the status to see when your result is ready."
            }
          >
            {job.status === "completed" && Boolean(job.imageUrl) && (
              <Image
                source={{ uri: job.imageUrl }}
                accessibilityLabel="Generated virtual try-on result"
                style={ui.image}
              />
            )}
            {job.status === "completed" && !job.imageUrl && (
              <Text style={ui.error}>
                The service did not return a result image.
              </Text>
            )}
            {(job.status === "queued" || job.status === "processing") && (
              <Button
                label="Check status"
                variant="secondary"
                onPress={refresh}
                loading={busy}
              />
            )}
          </Notice>
        )}
        <Button
          label="Clear try-on draft"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setPerson(null);
            setSelected(null);
            setIgnoreCatalog(true);
            setConsent(false);
            setJob(null);
            setMessage("");
          }}
        />
        <RouteLink to="/wardrobe/add" preview={preview}>
          Add a wardrobe piece →
        </RouteLink>
        <RouteLink to="/catalog" preview={preview}>
          Choose from catalog →
        </RouteLink>
      </Gate>
    </Screen>
  );
}
