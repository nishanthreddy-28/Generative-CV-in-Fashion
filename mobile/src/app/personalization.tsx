import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { Gate, Notice, ResourceState, Screen, ui, usePreview } from "../components/Screen";
import { useResource } from "../hooks/useResource";
import { useDraft } from "../hooks/useDraft";
import { useSession } from "../features/session";
import { buildPersonalizationPatch, occasions, type Occasion } from "../features/personalization";
import { colors } from "../theme/tokens";

type Preferences = {
  styleTags: string[];
  colorTags: string[];
  preferredFit: string | null;
  preferredOccasions: Occasion[];
  budgetMin: number | null;
  budgetMax: number | null;
  currency: "INR";
};

const fields = [
  { key: "styleTags", label: "Styles you reach for", kind: "multiline" as const,
    hint: "Separate words or short phrases with commas: minimal, vintage, linen." },
  { key: "colorTags", label: "Colours you enjoy", kind: "multiline" as const,
    hint: "List colours that feel like you. These help rank matching pieces." },
  { key: "preferredFit", label: "Preferred fit", options: ["No preference", "Fitted", "Regular", "Relaxed", "Oversized"] },
  { key: "budgetMin", label: "Minimum catalog piece price (INR)", kind: "number" as const, min: 0, max: 1000000, decimals: 2 },
  { key: "budgetMax", label: "Maximum catalog piece price (INR)", kind: "number" as const, min: 0, max: 1000000, decimals: 2 },
];

export default function Personalization() {
  const preview = usePreview();
  const { session, request } = useSession();
  const resource = useResource<Preferences>("/personalization/preferences", preview);
  const [draft, setDraft] = useDraft<Record<string, string>>("personalization:fields", {});
  const [occasionDraft, setOccasionDraft] = useDraft<Occasion[] | null>("personalization:occasions", null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const data = resource.data;
  const values: Record<string, string> = {
    styleTags: data?.styleTags.join(", ") ?? "",
    colorTags: data?.colorTags.join(", ") ?? "",
    preferredFit: data?.preferredFit ?? "No preference",
    budgetMin: data?.budgetMin == null ? "" : String(data.budgetMin),
    budgetMax: data?.budgetMax == null ? "" : String(data.budgetMax),
    ...draft,
  };
  const selectedOccasions = occasionDraft ?? data?.preferredOccasions ?? [];

  async function save() {
    const payload = buildPersonalizationPatch(values, selectedOccasions);
    if (!payload) {
      setError("Check the tags and price range. Tags must be unique and under 40 characters; the minimum cannot exceed the maximum.");
      setMessage("");
      return;
    }
    if (preview) {
      setMessage("Preview only. These preferences have not been saved.");
      return;
    }
    if (!session) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/personalization/preferences", { method: "PATCH", body: payload });
      setDraft({});
      setOccasionDraft(null);
      setMessage("Your style preferences are saved.");
      resource.retry();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your preferences.");
    } finally {
      setBusy(false);
    }
  }

  const ready = !!data && !resource.loading && !resource.error;
  return <Screen title="Your style, remembered." subtitle="Set the details that help your outfit suggestions feel more like you.">
    <Gate preview={preview}>
      <ResourceState {...resource} />
      {ready && <>
        <Notice title="Personalized, with clear limits"
          text="Style and colour words influence the existing transparent matching rules. Your price range filters shared catalog pieces by each piece’s listed price. Fit is saved to your body profile for future fit-aware matching; garments do not yet contain fit data." />
        <View style={ui.card}>
          <Fields fields={fields} values={values} errors={{}} disabled={busy}
            onChange={(key, value) => { setDraft(current => ({ ...current, [key]: value })); setMessage(""); setError(""); }} />
          <Text style={ui.label}>Occasions you usually dress for</Text>
          <View style={styles.chips}>
            {occasions.map(occasion => {
              const selected = selectedOccasions.includes(occasion);
              return <Pressable key={occasion} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: busy }}
                disabled={busy} onPress={() => setOccasionDraft(current => {
                  const active = current ?? data.preferredOccasions;
                  return selected ? active.filter(value => value !== occasion) : [...active, occasion];
                })} style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{occasion}</Text>
              </Pressable>;
            })}
          </View>
        </View>
        {Boolean(error) && <Notice tone="error" title="Check your preferences" text={error} />}
        {Boolean(message) && <Notice tone="success" title="Saved" text={message} />}
        <Button label="Save style preferences" onPress={save} loading={busy} />
      </>}
    </Gate>
  </Screen>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { minHeight: 40, paddingHorizontal: 13, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextSelected: { color: colors.surface, fontWeight: "600" },
});
