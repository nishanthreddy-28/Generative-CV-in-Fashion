import { useDraft } from "../../hooks/useDraft";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
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
import type { Garment, Page } from "../../types/domain";
const fields: Field[] = [
  { key: "name", label: "Outfit name", required: true },
  { key: "occasion", label: "Occasion" },
  { key: "description", label: "Notes", kind: "multiline" },
];
export default function NewOutfit() {
  const preview = usePreview();
  const { session, request } = useSession();
  const [cursor, setCursor] = useState("");
  const result = useResource<Page<Garment>>(
    `/wardrobe?limit=24${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    preview,
  );
  const [values, setValues] = useDraft<Record<string, string>>(
    "outfit-builder" + ":fields",
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ids, setIds] = useDraft<string[]>("outfit-builder:pieces", []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    const issues = validate(fields, values);
    if (ids.length < 2)
      issues.garments = "Select at least two wardrobe pieces.";
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
        body: { ...values, garmentIds: ids },
      });
      setValues({});
      setIds([]);
      router.replace("/outfits");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save outfit.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Put a look together.">
      <Gate preview={preview}>
        <Fields
          fields={fields}
          values={values}
          errors={errors}
          disabled={busy}
          onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
        />
        <Text style={ui.heading}>
          Choose your pieces · {ids.length} selected
        </Text>
        <ResourceState {...result} />
        {(result.data?.items ?? []).map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ids.includes(g.id) }}
            onPress={() =>
              setIds((s) =>
                s.includes(g.id) ? s.filter((id) => id !== g.id) : [...s, g.id],
              )
            }
            disabled={busy}
            style={[ui.chip, ids.includes(g.id) && ui.selected]}
          >
            <Text>
              {g.name} · {g.category}
            </Text>
          </Pressable>
        ))}
        {!result.loading && !result.error && !result.data?.items.length && (
          <Notice
            title="No pieces available"
            text="Add wardrobe garments before building an outfit. Preview does not supply sample garments."
          />
        )}
        {Boolean(result.data?.nextCursor) && (
          <Button
            label="Next page of garments"
            variant="secondary"
            onPress={() => setCursor(result.data!.nextCursor!)}
            disabled={busy}
          />
        )}
        {Boolean(cursor) && (
          <Button
            label="First page of garments"
            variant="secondary"
            onPress={() => setCursor("")}
            disabled={busy}
          />
        )}
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
