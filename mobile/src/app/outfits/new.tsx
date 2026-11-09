import { useDraft } from "../../hooks/useDraft";
import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Gate,
  Notice,
  RouteLink,
  usePreview,
  ui,
} from "../../components/Screen";
import { Fields } from "../../components/Fields";
import { Button } from "../../components/Button";
import { OutfitItemSelector } from "../../features/OutfitItemSelector";
import { itemError, itemReferences } from "../../features/outfitItems";
import { useSession } from "../../features/session";
import { validate, type Field } from "../../features/validation";
import type { OutfitItem } from "../../types/domain";
const fields: Field[] = [
  { key: "name", label: "Outfit name", required: true },
  { key: "occasion", label: "Occasion" },
  { key: "description", label: "Notes", kind: "multiline" },
];
export default function NewOutfit() {
  const preview = usePreview();
  const { session, request } = useSession();
  const [values, setValues] = useDraft<Record<string, string>>(
    "outfit-builder" + ":fields",
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [items, setItems] = useDraft<OutfitItem[]>("outfit-builder:typed-pieces", []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    const issues = validate(fields, values);
    if (itemError(items)) issues.garments = itemError(items);
    setErrors(issues);
    if (Object.keys(issues).length) return;
    if (preview) {
      setMessage("Preview only. This outfit has not been saved.");
      return;
    }
    if (!session) return;
    setBusy(true);
    try {
      await request("/outfits", {
        method: "POST",
        body: { ...values, items: itemReferences(items) },
      });
      setValues({});
      setItems([]);
      router.replace("/outfits");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save outfit.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Create outfit">
      <Gate preview={preview}>
        <Fields
          fields={fields}
          values={values}
          errors={errors}
          disabled={busy}
          onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
        />
        <OutfitItemSelector items={items} onChange={setItems} preview={preview} disabled={busy} />
        <View>
          {Boolean(errors.garments) && (
            <Text accessibilityRole="alert" style={ui.error}>
              {errors.garments}
            </Text>
          )}
        </View>
        {Boolean(message) && <Notice title="Outfit status" text={message} />}
        <Button label="Save outfit" onPress={save} loading={busy} />
        <RouteLink to="/wardrobe/add" preview={preview}>
          Add a piece →
        </RouteLink>
        <RouteLink to="/outfits" preview={preview}>
          Back to saved outfits
        </RouteLink>
      </Gate>
    </Screen>
  );
}
