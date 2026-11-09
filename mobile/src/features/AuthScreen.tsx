import {FramedImage} from "../components/FramedImage";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Screen, RouteLink, Notice, ui } from "../components/Screen";
import { Button } from "../components/Button";
import { colors, typography } from "../theme/tokens";
import { passwordChecks, passwordIssue } from "../services/auth/passwordPolicy";
import { Fields } from "../components/Fields";
import { type Field, validate } from "./validation";
import { useSession } from "./session";
import { emailRedirect, requireAuth, supabase } from "../services/auth/supabase";
import { beginGoogleOAuth, authError } from "../services/auth/contracts";
const reviewOnly = process.env.EXPO_PUBLIC_REVIEW_ONLY === "true";
const googleEnabled=process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
export function AuthScreen({ mode }: { mode: "login" | "signup" | "reset" }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const { login, session, ready } = useSession();
  const fields: Field[] = [
    { key: "email", label: "Email", required: true, kind: "email" },
    ...(mode !== "reset"
      ? [
          {
            key: "password",
            label: "Password",
            required: true,
            kind: "password" as const,
            passwordPurpose: mode==="signup" ? "new" as const : "current" as const,
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
            passwordPurpose: mode==="signup" ? "new" as const : "current" as const,
          },
        ]
      : []),
  ];
  async function submit() {
    const issues = validate(fields, values);
    if (mode === "signup") {
      const issue = passwordIssue(values.password ?? "", values.email);
      if (issue) issues.password = issue;
    }
    if (mode === "signup" && values.password !== values.confirm)
      issues.confirm = "Passwords must match.";
    setErrors(issues);
    setMessage("");
    setSuccess(false);
    if (Object.keys(issues).length) return;
    if (mode === "signup") {
      setMessage("Registration is unavailable while email verification is being configured.");
      return;
    }
    if (reviewOnly) {
      setMessage(mode === "reset" ? "Password recovery is temporarily unavailable. Please try again later." : "Sign-in is temporarily unavailable. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(values.email, values.password);
        router.replace("/dashboard");
      } else {
        const auth = requireAuth();
        const { error } = await auth.resetPasswordForEmail(values.email.trim(), {
          redirectTo: emailRedirect("reset-password"),
        });
        if (error && error.code !== "user_not_found") throw new Error(authError(error.code));
        setMessage("If an account exists for this address, you will receive password reset instructions.");
        setSuccess(true);
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
  async function google(){
    if(busy)return;setBusy(true);setMessage("");
    try{
      const target=await beginGoogleOAuth(requireAuth(),emailRedirect("oauth-callback"));
      const origin=new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").origin;
      if(target.origin!==origin || !target.pathname.startsWith("/auth/v1/"))throw new Error("Unexpected sign-in destination.");
      if(Platform.OS==="web")window.location.assign(target.href);else await Linking.openURL(target.href);
    }catch(e){setMessage(e instanceof Error ? e.message : "Unable to start Google sign-in.");}
    finally{setBusy(false);}
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
      <View style={styles.layout}>
        {mode !== "reset" && (
          <View style={styles.editorial}>
            <FramedImage source={require("../../assets/editorial/campaign-daylight.jpg")}
              ratio={1.8} contain label="Model wearing chocolate tailoring and ivory knitwear" />
            <View style={styles.caption}>
              <Text style={styles.eyebrow}>THE PERSONAL EDIT</Text>
              <Text style={styles.captionTitle}>A place for the pieces you love.</Text>
            </View>
          </View>
        )}
        <View style={styles.form}>
          {session && (
            <RouteLink to="/dashboard">Continue to your dashboard</RouteLink>
          )}
          {(reviewOnly || !supabase) && mode !== "signup" && (
            <Notice
              title={mode === "reset" ? "Password recovery is temporarily unavailable" : "Sign-in is temporarily unavailable"}
              text="Please try again later. Your account details have not been submitted."
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
          {mode === "signup" && (
            <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
              <Text style={ui.label}>
                Password strength · {passwordChecks(values.password ?? "", values.email).every(check => check.passed) ? "Requirements met" : "Needs attention"}
              </Text>
              {passwordChecks(values.password ?? "", values.email).map(check => (
                <Text key={check.label} style={check.passed ? ui.body : ui.error}>
                  {check.passed ? "✓" : "○"} {check.label}
                </Text>
              ))}
              {!!values.confirm && <Text style={values.confirm === values.password ? ui.body : ui.error}>
                {values.confirm === values.password ? "Passwords match." : "Passwords must match."}
              </Text>}
              <Notice title="Registration opens soon"
                text="New accounts will be available soon." />
            </View>
          )}
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
                  ? "Registration opens soon"
                  : "Send reset instructions"
            }
            loading={busy}
            disabled={!ready || busy || mode === "signup" || (!reviewOnly && !supabase)}
            onPress={submit}
          />
          {mode !== "reset" && !reviewOnly && googleEnabled && (
            <View style={{ gap: 12 }}>
              <Button
                label="Continue with Google"
                variant="secondary"
                disabled={busy}
                onPress={google}
              />
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
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { gap: 24 },
  editorial: { backgroundColor: colors.editorial, overflow: "hidden" },
  caption: { gap: 8, padding: 18 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: colors.sage, fontWeight: "700" },
  captionTitle: { ...typography.editorial, fontSize: 23, lineHeight: 28 },
  form: { gap: 16 },
});
