import { useDraft } from "../../hooks/useDraft";
import { useState } from "react";
import { Image, Text } from "react-native";
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
import { Fields } from "../../components/Fields";
import { Button } from "../../components/Button";
import { useResource } from "../../hooks/useResource";
import { useSession } from "../../features/session";
import { validate, type Field } from "../../features/validation";
import type { Outfit, OutfitItem } from "../../types/domain";
import { OutfitItemSelector } from "../../features/OutfitItemSelector";
import { itemError, itemReferences } from "../../features/outfitItems";
const fields: Field[] = [
  { key: "name", label: "Outfit name", required: true },
  { key: "occasion", label: "Occasion" },
  { key: "description", label: "Notes", kind: "multiline" },
];
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const preview = usePreview();
  const { session, request } = useSession();
  const path = `/outfits/${encodeURIComponent(id)}`;
  const result = useResource<Outfit>(path, preview);
  const [draft, setValues] = useDraft<Record<string, string>>(
    path + ":fields",
    {},
  );
  const values: Record<string, string> = {
    name: result.data?.name ?? "",
    occasion: result.data?.occasion ?? "",
    description: result.data?.description ?? "",
    ...draft,
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [itemDraft, setItemDraft] = useDraft<OutfitItem[] | null>(path + ":typed-items", null);
  const items = itemDraft ?? result.data?.items ?? [];
  async function mutate() {
    const issues = validate(fields, values);
    setErrors(issues);
    if (Object.keys(issues).length) return;
    if (preview) {
      setMessage("Preview only. No outfit has been changed.");
      return;
    }
    if (!session) return;
    setBusy(true);
    try {
      await request(path, { method: "PATCH", body: values });
      setMessage("Outfit details saved. Any unsaved item selection is retained.");
      setValues({});
      result.retry();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to update outfit.");
    } finally {
      setBusy(false);
    }
  }
  async function saveItems() {
    const error = itemError(items);
    if (error) { setMessage(error); return; }
    if (preview) { setMessage("Preview only. No outfit items have been saved."); return; }
    if (!session || !result.data) return;
    setBusy(true);
    try {
      await request(path + "/items", { method: "PUT", body: { items: itemReferences(items) } });
      setItemDraft(null);
      setMessage("Outfit pieces saved.");
      result.retry();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save pieces. Your selection is retained.");
    } finally { setBusy(false); }
  }
  return (
    <Screen title="The outfit edit.">
      <Gate preview={preview}>
        <ResourceState {...result} />
        {(result.data || preview) && (
          <>
            {Boolean(result.data?.imageUrl) && (
              <Image
                source={{ uri: result.data?.imageUrl }}
                accessibilityLabel={result.data?.name}
                style={ui.image}
              />
            )}
            <Fields
              fields={fields}
              values={values}
              errors={errors}
              disabled={busy}
              onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
            />
            <OutfitItemSelector items={items} onChange={setItemDraft} preview={preview} disabled={busy} />
            {itemDraft !== null && <Text style={ui.body}>Unsaved item changes · save the selection to apply them.</Text>}
            <Button label="Save outfit pieces" onPress={saveItems} loading={busy} disabled={!preview && !result.data} />
            <Button label="Discard item changes" variant="secondary" disabled={busy || itemDraft === null} onPress={() => setItemDraft(null)} />
            {Boolean(message) && (
              <Notice title="Outfit status" text={message} />
            )}
            <Button
              label="Save outfit details"
              onPress={mutate}
              loading={busy}
            />
          </>
        )}
        <RouteLink to="/outfits" preview={preview}>
          Back to saved outfits
        </RouteLink>
      </Gate>
    </Screen>
  );
}
