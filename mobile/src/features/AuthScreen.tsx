import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, RouteLink, Notice, ui } from "../components/Screen";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { type Field, validate } from "./validation";
import { useSession } from "./session";
import { authApi } from "../services/api/resources";
import { isApiConfigured } from "../services/api/client";
export function AuthScreen({ mode }: { mode: "login" | "signup" | "reset" }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const { login, session } = useSession();
  const fields: Field[] = [
    ...(mode === "signup"
      ? [{ key: "name", label: "Name", required: true }]
      : []),
    { key: "email", label: "Email", required: true, kind: "email" },
    ...(mode !== "reset"
      ? [
          {
            key: "password",
            label: "Password",
            required: true,
            kind: "password" as const,
          },
        ]
      : []),
    ...(mode === "signup"
      ? [
          {
            key: "confirm",
            label: "Confirm password",
            required: true,
            kind: "password" as const,
          },
        ]
      : []),
  ];
  async function submit() {
    const issues = validate(fields, values);
    if (mode === "signup" && values.password !== values.confirm)
      issues.confirm = "Passwords must match.";
    setErrors(issues);
    setMessage("");
    setSuccess(false);
    if (Object.keys(issues).length) return;
    setBusy(true);
    try {
      if (mode === "login") {
        await login(values.email, values.password);
        router.replace("/dashboard");
      } else {
        if (mode === "signup")
          await authApi.signup(
            values.name.trim(),
            values.email.trim(),
            values.password,
          );
        else await authApi.reset(values.email.trim());
        setSuccess(true);
        setMessage(
          mode === "signup"
            ? "Your request was accepted. Check your email for next steps before signing in."
            : "If an account exists for this address, you will receive password reset instructions.",
        );
        setValues({});
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to complete this request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={
        mode === "login"
          ? "Your style. Your space."
          : mode === "signup"
            ? "Make it personal."
            : "A fresh start."
      }
      subtitle={
        mode === "reset"
          ? "Enter your account email to request a reset link."
          : "A considered wardrobe starts with you."
      }
    >
      {session && (
        <RouteLink to="/dashboard">Continue to your dashboard</RouteLink>
      )}
      {!isApiConfigured() && (
        <Notice
          title="Account service not connected"
          text="You can review and validate these forms. Sign-in and account creation require the backend; no demo account will be created."
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
          setMessage("");
        }}
      />
      {Boolean(message) && (
        <Text accessibilityRole="alert" style={success ? ui.body : ui.error}>
          {message}
        </Text>
      )}
      <Button
        label={
          mode === "login"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Send reset instructions"
        }
        loading={busy}
        onPress={submit}
      />
      {mode !== "reset" && (
        <View style={{ gap: 12 }}>
          <Button
            label="Continue with Google"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setSuccess(false);
              setMessage(
                "Google sign-in requires the authentication integration in the next backend phase. No account has been created.",
              );
            }}
          />
          <Text style={ui.body}>
            Google account connection will be enabled with authentication
            integration.
          </Text>
        </View>
      )}
      {mode === "login" ? (
        <>
          <RouteLink to="/signup">Create an account</RouteLink>
          <RouteLink to="/forgot-password">Forgot password?</RouteLink>
        </>
      ) : (
        <RouteLink to="/login">Back to sign in</RouteLink>
      )}
      <RouteLink to="/preview">Review all frontend workflows</RouteLink>
    </Screen>
  );
}
