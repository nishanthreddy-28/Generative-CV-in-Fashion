import { useState } from "react";
import { Image, Text } from "react-native";
import { router, type Href } from "expo-router";
import { Fields } from "../components/Fields";
import { Button } from "../components/Button";
import {
  Confirm,
  Gate,
  Notice,
  ResourceState,
  Screen,
  usePreview,
  ui,
} from "../components/Screen";
import { PhotoField, appendPhoto, type Photo } from "../components/PhotoField";
import { useResource } from "../hooks/useResource";
import { useSession } from "./session";
import { ApiError } from "../services/api/client";
import { type Field, validate, payloadFor } from "./validation";
type Props = {
  title: string;
  subtitle?: string;
  path: string;
  fields: Field[];
  create?: boolean;
  photo?: boolean;
  admin?: boolean;
  afterSave?: string;
  allowDelete?: boolean;
};
export function EditorScreen({
  title,
  subtitle,
  path,
  fields,
  create = false,
  photo = false,
  admin = false,
  afterSave,
  allowDelete = false,
}: Props) {
  const preview = usePreview();
  const { session, expire, request } = useSession();
  const result = useResource<Record<string, unknown>>(
    path,
    preview || create,
    admin,
  );
  const [draft, setValues] = useState<Record<string, string>>({});
  const values: Record<string, string> = {
    ...Object.fromEntries(
      fields.map((f) => [
        f.key,
        result.data?.[f.key] == null ? "" : String(result.data[f.key]),
      ]),
    ),
    ...draft,
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [image, setImage] = useState<Photo | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "discard" | null>(null);
  async function save() {
    const issues = validate(fields, values);
    if (photo && create && !image) issues.photo = "Choose a garment photo.";
    setErrors(issues);
    setMessage("");
    if (Object.keys(issues).length) return;
    if (preview) {
      setMessage(
        "Preview validation passed. This draft has not been saved or uploaded.",
      );
      return;
    }
    if (!session) return;
    setBusy(true);
    try {
      const payload = payloadFor(fields, values);
      let body: unknown = payload;
      if (photo) {
        const form = new FormData();
        form.append("metadata", JSON.stringify(payload));
        if (image) appendPhoto(form, "image", image);
        body = form;
      }
      await request(path, {
        method: create ? "POST" : "PATCH",
        token: session.accessToken,
        body,
      });
      setDirty(false);
      setValues({});
      setImage(null);
      setMessage("Saved successfully.");
      if (afterSave) router.replace(afterSave as Href);
      else result.retry();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expire();
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to save. Your draft is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (preview) {
      setMessage("Preview only. No record has been deleted.");
      setConfirm(null);
      return;
    }
    if (!session) return;
    setBusy(true);
    try {
      await request(path, { method: "DELETE", token: session.accessToken });
      router.replace((afterSave ?? "/wardrobe") as Href);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to delete.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  const unavailable =
    !preview &&
    !create &&
    (result.loading || Boolean(result.error) || !result.data);
  return (
    <Screen title={title} subtitle={subtitle}>
      <Gate preview={preview} admin={admin}>
        <ResourceState {...result} />
        {dirty && (
          <Text style={ui.body}>
            Unsaved changes · keep this screen open to retain your draft.
          </Text>
        )}
        {!unavailable && (
          <>
            {photo && typeof result.data?.imageUrl === "string" && (
              <Image
                source={{ uri: result.data.imageUrl }}
                accessibilityLabel="Current garment photo"
                style={ui.image}
              />
            )}
            <Fields
              fields={fields}
              values={values}
              errors={errors}
              disabled={busy}
              onChange={(k, v) => {
                setValues((s) => ({ ...s, [k]: v }));
                setErrors((s) => ({ ...s, [k]: "" }));
                setDirty(true);
                setMessage("");
              }}
            />
            {photo && (
              <PhotoField
                label={
                  create
                    ? "Garment photo *"
                    : "Replace garment photo (optional)"
                }
                value={image}
                onChange={(p) => {
                  setImage(p);
                  setDirty(true);
                }}
                disabled={busy}
              />
            )}
            {Boolean(errors.photo) && (
              <Text accessibilityRole="alert" style={ui.error}>
                {errors.photo}
              </Text>
            )}
            {Boolean(message) && <Notice title="Form status" text={message} />}
            <Button
              label={create ? "Add garment" : "Save changes"}
              onPress={save}
              loading={busy}
            />
            <Button
              label="Discard changes"
              variant="secondary"
              disabled={!dirty || busy}
              onPress={() => setConfirm("discard")}
            />
            {allowDelete && (
              <Button
                label="Delete garment"
                variant="danger"
                disabled={busy}
                onPress={() => setConfirm("delete")}
              />
            )}
          </>
        )}
        <Confirm
          visible={confirm !== null}
          title={
            confirm === "delete"
              ? "Delete this garment?"
              : "Discard unsaved changes?"
          }
          text={
            confirm === "delete"
              ? "This removes the selected garment from your collection."
              : "This clears edits on this screen and restores the last loaded details."
          }
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === "delete") {
              void remove();
              return;
            }
            setValues(
              Object.fromEntries(
                fields.map((f) => [
                  f.key,
                  result.data?.[f.key] == null
                    ? ""
                    : String(result.data[f.key]),
                ]),
              ),
            );
            setImage(null);
            setErrors({});
            setMessage("");
            setDirty(false);
            setConfirm(null);
          }}
        />
      </Gate>
    </Screen>
  );
}
