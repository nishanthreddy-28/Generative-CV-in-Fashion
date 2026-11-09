import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Gate,
  Notice,
  Confirm,
  RouteLink,
  usePreview,
  ui,
} from "../components/Screen";
import { Fields } from "../components/Fields";
import { Button } from "../components/Button";
import { useSession } from "../features/session";
import { requireAuth } from "../services/auth/supabase";
import { reauthenticate, authError } from "../services/auth/contracts";
import { validate, type Field } from "../features/validation";
const passwordFields: Field[] = [
  {
    key: "currentPassword",
    label: "Current password",
    kind: "password",
    required: true,
  },
  {
    key: "newPassword",
    label: "New password",
    kind: "password",
    required: true,
  },
  {
    key: "confirmPassword",
    label: "Confirm new password",
    kind: "password",
    required: true,
  },
];
export default function Settings() {
  const preview = usePreview();
  const { session, logout, request } = useSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deletion, setDeletion] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "logout" | null>(null);
  async function password() {
    const issues = validate(passwordFields, values);
    if (values.newPassword !== values.confirmPassword)
      issues.confirmPassword = "Passwords must match.";
    if (values.currentPassword === values.newPassword && values.newPassword)
      issues.newPassword = "Choose a different password.";
    setErrors(issues);
    if (Object.keys(issues).length) return;
    if(preview){setMessage("Preview validation passed. No password was changed.");return;}
    if(!session)return;setBusy(true);
    try {
      const auth=requireAuth();await reauthenticate(auth,session.user.email,values.currentPassword,session.user.id);
      const {error}=await auth.updateUser({password:values.newPassword});
      if(error)throw new Error(authError(error.code));
      setValues({});setMessage("Password updated. Other sessions may require sign-in again.");
    }catch(e){setMessage(e instanceof Error ? e.message : "Unable to change password.");}
    finally{setBusy(false);}
  }
  async function confirmed() {
    if (preview) {
      setMessage(
        `Preview only. No ${confirm === "delete" ? "account was deleted" : "session was signed out"}.`,
      );
      setConfirm(null);
      return;
    }
    setBusy(true);
    try {
      if (confirm === "logout") {
        await logout();
        router.replace("/login");
      } else if (session) {
        if(deletion.password)await reauthenticate(requireAuth(),session.user.email,deletion.password,session.user.id);
        await request("/account", {
          method: "DELETE",
          body: { confirmation: "DELETE" },
        });
        setDeletion({});setMessage("Deletion accepted. Your private data is inaccessible; trusted cleanup is pending.");
        router.replace("/account-deletion");
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to complete request.",
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  return (
    <Screen title="Make it yours.">
      <Gate preview={preview}>
        {session && <Notice title="Your account" text={session.user.email} />}
        <RouteLink to="/profile" preview={preview}>
          Edit personal profile →
        </RouteLink>
        <RouteLink to="/profile/body" preview={preview}>
          Edit body & fit details →
        </RouteLink>
        <RouteLink to="/preferences" preview={preview}>
          Units & email preferences →
        </RouteLink>
        <View style={ui.card}>
          <Text style={ui.heading}>Change password</Text>
          {<Fields
            fields={passwordFields}
            values={values}
            errors={errors}
            disabled={busy}
            onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
          />}
          {<Button label="Update password" onPress={password} loading={busy} />}
          <RouteLink to="/forgot-password">
            Request a password reset instead
          </RouteLink>
        </View>
        <View style={ui.card}>
          <Text style={ui.heading}>Privacy & account</Text>
          <Text style={ui.body}>
            Photos are selected only when you choose them. Preview drafts are
            not stored or uploaded. Personal data policies and retention
            controls will be finalized before release.
          </Text>
          <Text style={ui.body}>
            Sessions are stored securely on mobile. Web sessions end when you reload the page.
          </Text>
          <Button
            label="Sign out"
            variant="secondary"
            disabled={busy}
            onPress={() => setConfirm("logout")}
          />
        </View>
        <View style={ui.card}>
          <Text style={ui.heading}>Delete account</Text>
          <Text style={ui.body}>
            Request permanent deletion of your account and associated personal
            data. Type DELETE to enable confirmation. Password accounts can confirm with their password below. Google-only accounts must sign in again first; the server requires sign-in within five minutes.
          </Text>
          <Fields
            fields={[{ key: "confirmation", label: "Deletion confirmation" },{key:"password",label:"Current password for deletion",kind:"password"}]}
            values={deletion}
            errors={{}}
            onChange={(k, v) => setDeletion(current=>({...current,[k]:v}))}
            disabled={busy}
          />
          <Button
            label="Delete my account"
            variant="danger"
            disabled={deletion.confirmation !== "DELETE" || busy}
            onPress={() => setConfirm("delete")}
          />
        </View>
        {Boolean(message) && <Notice title="Account status" text={message} />}
        {(preview || session?.user.role === "admin") && (
          <RouteLink to="/admin" preview={preview}>
            Admin catalog studio →
          </RouteLink>
        )}
        <Confirm
          visible={confirm !== null}
          title={
            confirm === "delete"
              ? "Permanently delete your account?"
              : "Sign out of this session?"
          }
          text={
            confirm === "delete"
              ? "This request removes your account and personal data. Continue only if you intend to delete them."
              : "Unsaved form drafts may be lost when you leave."
          }
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmed}
        />
      </Gate>
    </Screen>
  );
}
