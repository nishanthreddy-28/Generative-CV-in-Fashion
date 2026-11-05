import { useState } from "react";
import { Image, Text, View } from "react-native";
import {
  Screen,
  Gate,
  Notice,
  RouteLink,
  usePreview,
  ui,
} from "../components/Screen";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { validate, type Field } from "./validation";
import { useSession } from "./session";
import { ApiError } from "../services/api/client";
import type { Outfit, Page } from "../types/domain";
const fields: Field[] = [
  {
    key: "occasion",
    label: "Occasion",
    required: true,
    options: ["Everyday", "Work", "Evening", "Weekend", "Special occasion"],
  },
  {
    key: "preferences",
    label: "What are you in the mood for?",
    kind: "multiline",
  },
  {
    key: "wardrobeOnly",
    label: "Pieces to include",
    required: true,
    options: ["My wardrobe only", "Wardrobe and catalog"],
  },
];
export function RecommendationsScreen() {
  const preview = usePreview();
  const { session, expire, request } = useSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [looks, setLooks] = useState<Outfit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  async function generate() {
    const issues = validate(fields, values);
    setErrors(issues);
    setMessage("");
    if (Object.keys(issues).length) return;
    if (preview) {
      setMessage(
        "Preview validation passed. No recommendations have been generated.",
      );
      return;
    }
    if (!session) return;
    setBusy(true);
    setLooks(null);
    setSaved([]);
    try {
      const result = await request<Page<Outfit>>("/recommendations", {
        method: "POST",
        token: session.accessToken,
        body: {
          occasion: values.occasion,
          preferences: values.preferences ?? "",
          wardrobeOnly: values.wardrobeOnly === "My wardrobe only",
        },
      });
      setLooks(result.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expire();
      setMessage(
        e instanceof Error ? e.message : "Unable to create recommendations.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(look: Outfit) {
    if (!session || saving) return;
    setSaving(look.id);
    setMessage("");
    try {
      await request("/outfits", {
        method: "POST",
        token: session.accessToken,
        body: { recommendationId: look.id },
      });
      setSaved((s) => [...s, look.id]);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to save this outfit.",
      );
    } finally {
      setSaving("");
    }
  }
  return (
    <Screen
      title="Find your next look."
      subtitle="Thoughtful combinations, tailored to your wardrobe."
    >
      <Gate preview={preview}>
        <Fields
          fields={fields}
          values={values}
          errors={errors}
          disabled={busy}
          onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
        />
        <Button label="Find outfits" onPress={generate} loading={busy} />
        {Boolean(message) && <Notice title="Recommendation status" text={message} />}
        {looks?.length === 0 && (
          <Notice
            title="No outfits found"
            text="Add more wardrobe pieces or try another occasion."
          />
        )}
        {looks?.map((look) => (
          <View key={look.id} style={ui.card}>
            {Boolean(look.imageUrl) && (
              <Image
                accessibilityLabel={look.name}
                source={{ uri: look.imageUrl }}
                style={ui.image}
              />
            )}
            <Text style={ui.heading}>{look.name}</Text>
            {Boolean(look.description) && (
              <Text style={ui.body}>{look.description}</Text>
            )}
            <Button
              label={saved.includes(look.id) ? "Saved" : "Save outfit"}
              disabled={saved.includes(look.id) || Boolean(saving)}
              loading={saving === look.id}
              onPress={() => save(look)}
            />
          </View>
        ))}
        <RouteLink to="/outfits" preview={preview}>
          View saved outfits →
        </RouteLink>
        <RouteLink to="/wardrobe/add" preview={preview}>
          Add a wardrobe piece →
        </RouteLink>
      </Gate>
    </Screen>
  );
}
