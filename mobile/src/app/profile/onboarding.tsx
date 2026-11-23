import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { Button } from "../../components/Button";
import { Fields } from "../../components/Fields";
import { Notice, ResourceState, Screen, ui } from "../../components/Screen";
import { PhotoField, appendPhoto, type Photo } from "../../components/PhotoField";
import { useSession } from "../../features/session";
import type { Field } from "../../features/validation";
import { useResource } from "../../hooks/useResource";
import { useDraft } from "../../hooks/useDraft";
import { colors } from "../../theme/tokens";

type Version = { id: string; state: "pending" | "ready" | "reviewed" | "cleanup_pending" | "removed"; confirmedValues?: Record<string, unknown> | null };
type Status = { processingAvailable: false; draft: Version | null; reviewed: Version | null };
const formFields: Field[] = [
  { key: "name", label: "Your name", required: true },
  { key: "location", label: "Location (optional)" },
  { key: "units", label: "Measurement units", required: true, options: ["cm", "in"] },
  ...["height", "chest", "waist", "hips", "inseam"].map(key => ({
    key, label: `${key[0].toUpperCase()}${key.slice(1)} (optional)`, kind: "number" as const, min: 1, max: 300,
  })),
];

function PrivateBodyPhoto({ id }: { id: string }) {
  const image = useResource<Blob>(`/onboarding/body-photo/${encodeURIComponent(id)}`, false, false, "image");
  const [preview, setPreview] = useState<{ blob: Blob; uri: string } | null>(null);
  useEffect(() => {
    if (!image.data) return;
    const reader = new FileReader();
    const blob = image.data;
    reader.onload = () => { if (typeof reader.result === "string") setPreview({ blob, uri: reader.result }); };
    reader.readAsDataURL(image.data);
    return () => { reader.onload = null; if (reader.readyState === FileReader.LOADING) reader.abort(); };
  }, [image.data]);
  const uri = image.data && preview?.blob === image.data ? preview.uri : "";
  return <View style={styles.photoFrame}>
    {uri ? <Image source={{ uri }} accessibilityLabel="Your private body profile photo" resizeMode="cover" style={StyleSheet.absoluteFill} /> :
      <Text style={ui.body}>{image.loading ? "Loading your private photo…" : image.error || "Photo preview unavailable."}</Text>}
  </View>;
}

export default function Onboarding() {
  const { session, request } = useSession();
  const [values, setValues] = useDraft<Record<string, string>>("onboarding:values", { units: "cm" });
  const [photo, setPhoto] = useDraft<Photo | null>("onboarding:photo", null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const [next, profile, body] = await Promise.all([
        request<Status>("/onboarding"),
        request<Record<string, unknown>>("/profile"),
        request<Record<string, unknown>>("/profile/body"),
      ]);
      if (next.processingAvailable !== false) throw new Error("Onboarding service returned an invalid status.");
      setStatus(next);
      setError("");
      const source = next.reviewed?.confirmedValues ?? {};
      setValues(current => ({
        name: String(source.name ?? profile.name ?? ""),
        location: String(source.location ?? profile.location ?? ""),
        units: String(source.units ?? body.units ?? "cm"),
        ...Object.fromEntries(["height", "chest", "waist", "hips", "inseam"].map(key => [key,
          source[key] == null ? body[key] == null ? "" : String(body[key]) : String(source[key])])),
        ...current,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your onboarding details could not be loaded.");
    } finally { setLoading(false); }
  }, [request, session, setValues]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh, revision]);
  function retryLoad() { setLoading(true); setRevision(value => value + 1); }
  const activeVersion = status?.draft ?? status?.reviewed ?? null;
  const canReview = status?.draft?.state === "ready";
  const fields = useMemo(() => formFields, []);

  async function submitPhoto() {
    if (!photo || !session || busy) return;
    const id = status?.draft?.state === "pending" ? status.draft.id : Crypto.randomUUID();
    setBusy(true); setError(""); setMessage("");
    try {
      const form = new FormData(); appendPhoto(form, "image", photo);
      await request(`/onboarding/body-photo/${encodeURIComponent(id)}`, { method: "POST", body: form });
      setPhoto(null); setMessage("Photo saved privately. Review your details below before confirming.");
      setRevision(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Photo upload failed. Retry the same photo to continue.");
      setRevision(value => value + 1);
    } finally { setBusy(false); }
  }

  async function confirmDetails() {
    const draft = status?.draft;
    if (!draft || !canReview || busy) return;
    if (!values.name?.trim() || !["cm", "in"].includes(values.units)) {
      setError("Enter your name and choose measurement units."); return;
    }
    setBusy(true); setError(""); setMessage("");
    const payload: Record<string, unknown> = { name: values.name.trim(), location: values.location ?? "", units: values.units };
    for (const key of ["height", "chest", "waist", "hips", "inseam"]) {
      const raw = values[key]?.trim();
      if (raw) {
        const number = Number(raw);
        if (!Number.isFinite(number) || number < 1 || number > 300) {
          setBusy(false); setError(`${key[0].toUpperCase()}${key.slice(1)} must be between 1 and 300 ${values.units}.`); return;
        }
        payload[key] = number;
      } else payload[key] = null;
    }
    try {
      await request(`/onboarding/body-photo/${encodeURIComponent(draft.id)}/review`, { method: "POST", body: payload });
      setMessage("Your profile was saved. Your photo and details remain private.");
      setRevision(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your details were not saved. Review and retry."); }
    finally { setBusy(false); }
  }

  async function discard() {
    if (!status?.draft || busy) return;
    setBusy(true); setError("");
    try {
      await request(`/onboarding/body-photo/${encodeURIComponent(status.draft.id)}`, { method: "DELETE" });
      setPhoto(null); setMessage("Unconfirmed photo draft discarded."); setRevision(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The photo draft could not be discarded."); }
    finally { setBusy(false); }
  }

  return <Screen title="Your profile, your fit" subtitle="Add a private body profile photo, then review and confirm your details. Automatic measurements are not available yet.">
    {loading ? <ResourceState loading error="" retry={retryLoad} /> : !status ?
      <ResourceState loading={false} error={error || "Your profile could not be loaded."} retry={retryLoad} /> : <>
      <View style={styles.step}><Text style={styles.number}>01</Text><View style={styles.stepCopy}><Text style={ui.heading}>Add a body photo</Text><Text style={ui.body}>Use a clear, well-lit full-body photo. It is private and is not analyzed while automatic processing is unavailable.</Text></View></View>
      {activeVersion?.id && <PrivateBodyPhoto id={activeVersion.id} />}
      {!status.draft || status.draft.state === "pending" ? <>
        <PhotoField label="Body profile photo" subject="body profile" camera value={photo} disabled={busy} onChange={setPhoto} />
        <Button label={status.draft?.state === "pending" ? "Retry photo upload" : status.reviewed ? "Add a new photo version" : "Save private photo"} loading={busy} disabled={!photo || busy} onPress={() => void submitPhoto()} />
      </> : status.draft.state === "cleanup_pending" || status.draft.state === "removed" ?
        <Notice title="This photo draft is no longer available" text="Choose a new photo to continue." /> : null}
      {status.draft?.state === "ready" && <>
        <View style={styles.step}><Text style={styles.number}>02</Text><View style={styles.stepCopy}><Text style={ui.heading}>Review your details</Text><Text style={ui.body}>No details are inferred. Enter or correct the information yourself, then confirm.</Text></View></View>
        <View style={ui.card}><Fields fields={fields} values={values} errors={{}} disabled={busy} onChange={(key, value) => setValues(current => ({ ...current, [key]: value }))} /></View>
        <Button label="Confirm profile" loading={busy} disabled={busy} onPress={() => void confirmDetails()} />
        <Button label="Discard photo draft" variant="secondary" disabled={busy} onPress={() => void discard()} />
      </>}
      {status.reviewed && !status.draft && <Notice title="Profile confirmed" text="Your confirmed details are stored in your profile. You can edit measurements from your account." />}
      {!!message && <Notice title="Saved" text={message} tone="success" />}
      {!!error && <Notice title="Could not complete this step" text={error} tone="error" />}
      <Button label="Continue to your wardrobe" variant="secondary" onPress={() => router.replace("/dashboard")} />
      {!status.reviewed && <Text style={styles.pending}>This step is optional for now. Your dashboard and wardrobe remain available.</Text>}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 14, alignItems: "flex-start", paddingTop: 8 },
  number: { color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1.4, paddingTop: 3 },
  stepCopy: { flex: 1, gap: 5 },
  photoFrame: { width: "100%", aspectRatio: 0.8, maxHeight: 420, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border },
  pending: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", paddingHorizontal: 10 },
});
