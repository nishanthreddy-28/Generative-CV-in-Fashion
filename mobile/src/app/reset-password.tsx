import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen, Notice, RouteLink } from "../components/Screen";
import { Fields } from "../components/Fields";
import { Button } from "../components/Button";
import { validate, type Field } from "../features/validation";
import { authError, emailLinkHash, verifyEmailLink } from "../services/auth/contracts";
import { createEmailLinkAuth, supabase } from "../services/auth/supabase";
const fields: Field[] = [
  { key: "password", label: "New password", kind: "password", passwordPurpose:"new", required: true },
  {
    key: "confirm",
    label: "Confirm password",
    kind: "password",
    required: true,
  },
];
export default function ResetPassword() {
  const { token_hash } = useLocalSearchParams();
  const hash = emailLinkHash(token_hash);
  const [recovery, setRecovery] = useState<{
    hash: string;
    auth: ReturnType<typeof createEmailLinkAuth>;
  } | null>(null);
  const verified = recovery !== null && recovery.hash === hash;
  async function verify() {
    if (!hash || busy) return;
    setBusy(true);
    try {
      const auth = createEmailLinkAuth();
      await verifyEmailLink(auth, hash, "recovery");
      setRecovery({ hash, auth });
      setMessage("");
    } catch {
      setMessage("This recovery link is invalid or expired. Request a new link.");
    } finally {
      setBusy(false);
    }
  }
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  async function submit() {
    const issues = validate(fields, values);
    if (values.password !== values.confirm)
      issues.confirm = "Passwords must match.";
    setErrors(issues);
    if (Object.keys(issues).length) return;
    if (!verified || busy) return;
    setBusy(true);
    try {
      const { error } = await recovery.auth.updateUser({ password: values.password });
      if (error) throw new Error(authError(error.code));
      await recovery.auth.signOut({ scope: "local" }).catch(() => undefined);
      setRecovery(null);
      setDone(true);
      setValues({});
      setMessage("Your password was reset. You can sign in now.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to reset password. Request a fresh reset link.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="Set a new password."
      subtitle="Use the reset link from your account email."
    >
      {!done && !verified && (supabase && hash ? (
        <Button label="Verify recovery link" loading={busy} onPress={verify} />
      ) : (
        <Notice title="Recovery unavailable" text={supabase
          ? "Open the reset link sent to your email."
          : "Supabase sign-in is not configured."} />
      ))}
      {!done && verified && (
        <>
          <Fields
            fields={fields}
            values={values}
            errors={errors}
            onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
            disabled={busy}
          />
          <Button label="Reset password" loading={busy} onPress={submit} />
        </>
      )}
      {Boolean(message) && (
        <Notice title="Password reset status" text={message} />
      )}
      <RouteLink to="/forgot-password">Request a new reset link</RouteLink>
      <RouteLink to="/login">Back to sign in</RouteLink>
    </Screen>
  );
}
