import { useDraft } from "../../hooks/useDraft";
import { useState } from "react";
import { Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Gate,
  Notice,
  Confirm,
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
import type { Outfit } from "../../types/domain";
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
  const [confirm, setConfirm] = useState(false);
  async function mutate(remove = false) {
    const issues = remove ? {} : validate(fields, values);
    setErrors(issues);
    if (Object.keys(issues).length) return;
    if (preview) {
      setMessage("Preview only. No outfit has been changed.");
      setConfirm(false);
      return;
    }
    if (!session) return;
    setBusy(true);
    try {
      await request(path, {
        method: remove ? "DELETE" : "PATCH",
        token: session.accessToken,
        ...(remove ? {} : { body: values }),
      });
      if (remove) router.replace("/outfits");
      else {
        setMessage("Outfit saved.");
        setValues({});
        result.retry();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to update outfit.");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
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
            {result.data?.garmentIds.map((g) => (
              <RouteLink key={g} to={`/wardrobe/${encodeURIComponent(g)}`}>
                View wardrobe piece →
              </RouteLink>
            ))}
            {Boolean(message) && (
              <Notice title="Outfit status" text={message} />
            )}
            <Button
              label="Save outfit details"
              onPress={() => mutate()}
              loading={busy}
            />
            <Button
              label="Delete outfit"
              variant="danger"
              onPress={() => setConfirm(true)}
              disabled={busy}
            />
          </>
        )}
        <RouteLink to="/outfits" preview={preview}>
          Back to saved outfits
        </RouteLink>
        <Confirm
          visible={confirm}
          title="Delete this outfit?"
          text="Your wardrobe garments will remain in your collection."
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => mutate(true)}
        />
      </Gate>
    </Screen>
  );
}
