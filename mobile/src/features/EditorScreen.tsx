import { useDraft } from "../hooks/useDraft";
import { useState } from "react";
import { Text } from "react-native";
import { router, type Href } from "expo-router";
import { Fields } from "../components/Fields";
import { Button } from "../components/Button";
import { WardrobeImage } from "../components/WardrobeImage";
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
  const { session, request } = useSession();
  const result = useResource<Record<string, unknown>>(
    path,
    preview || create,
    admin,
  );
  const [draft, setValues] = useDraft<Record<string, string>>(
    path + ":fields",
    {},
  );
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
  const [image, setImage] = useDraft<Photo | null>(path + ":photo", null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useDraft(path + ":dirty", false);
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
        body,
      });
      setDirty(false);
      setValues({});
      setImage(null);
      setMessage("Saved successfully.");
      if (afterSave) router.replace(afterSave as Href);
      else result.retry();
    } catch (e) {
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
      await request(path, { method: "DELETE" });
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
            Unsaved changes · draft retained while navigating. Closing the app
            or signing out clears it.
          </Text>
        )}
        {!unavailable && (
          <>
            {photo && typeof result.data?.imageUrl === "string" && typeof result.data.id === "string" && (
              <WardrobeImage id={result.data.id} label="Current garment photo" preview={preview}
                source={admin ? "admin/catalog" : "wardrobe"} />
            )}
            {admin && result.data?.active === false &&
              <Notice title="Inactive catalog item" text="Hidden from the catalog. Its record and image are retained." />}
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
                label={admin ? "Deactivate catalog item" : "Delete garment"}
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
              ? admin ? "Deactivate this catalog item?" : "Delete this garment?"
              : "Discard unsaved changes?"
          }
          text={
            confirm === "delete"
              ? admin ? "This hides the item from catalog browsing and retains its record and image." : "This removes the selected garment from your collection."
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
