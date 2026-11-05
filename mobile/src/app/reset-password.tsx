import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen, Notice, RouteLink } from "../components/Screen";
import { Fields } from "../components/Fields";
import { Button } from "../components/Button";
import { validate, type Field } from "../features/validation";
import { apiRequest } from "../services/api/client";
const fields: Field[] = [
  { key: "password", label: "New password", kind: "password", required: true },
  {
    key: "confirm",
    label: "Confirm password",
    kind: "password",
    required: true,
  },
];
export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token?: string }>();
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
    if (!token) {
      setMessage(
        "Open the reset link sent to your email before setting a new password.",
      );
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/auth/password-reset/confirm", {
        method: "POST",
        body: { token, password: values.password },
      });
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
      {!done && (
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
