import {FramedImage} from "../components/FramedImage";
import { useState } from "react";
import { Platform, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Screen, RouteLink, Notice, ui } from "../components/Screen";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { type Field, validate } from "./validation";
import { useSession } from "./session";
import { emailRedirect, requireAuth, supabase } from "../services/auth/supabase";
import { beginGoogleOAuth, authError, signupMessage } from "../services/auth/contracts";
const googleEnabled=process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
export function AuthScreen({ mode }: { mode: "login" | "signup" | "reset" }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const { login, signup, session, ready } = useSession();
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
        const auth = requireAuth();
        if (mode === "signup") {
          setMessage(signupMessage(await signup(values.name.trim(), values.email.trim(), values.password)));
        } else {
          const { error } = await auth.resetPasswordForEmail(values.email.trim(), {
            redirectTo: emailRedirect("reset-password"),
          });
          if (error && error.code !== "user_not_found") throw new Error(authError(error.code));
          setMessage("If an account exists for this address, you will receive password reset instructions.");
        }
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
      {mode!=="reset" && <View style={{borderRadius:6,overflow:"hidden",backgroundColor:"#EAE7DF"}}><FramedImage source={require("../../assets/editorial/introduction.png")} ratio={2.4} contain label="Drape and Drop fashion editorial"/><View style={{padding:16,gap:6}}><Text style={{fontSize:10,letterSpacing:2,color:"#52604C",fontWeight:"700"}}>YOUR WARDROBE, CONSIDERED</Text><Text style={ui.body}>A place for your pieces, your ideas and your everyday style.</Text></View></View>}
      {session && (
        <RouteLink to="/dashboard">Continue to your dashboard</RouteLink>
      )}
      {!supabase && (
        <Notice
          title="Sign-in is temporarily unavailable"
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
        disabled={!ready || !supabase}
        onPress={submit}
      />
      {mode !== "reset" && googleEnabled && (
        <View style={{ gap: 12 }}>
          <Button
            label="Continue with Google"
            variant="secondary"
            disabled={busy}
            onPress={google}
          />
        </View>
      )}
      <RouteLink to="/privacy">Privacy &amp; your data</RouteLink>
      {mode === "login" ? (
        <>
          <RouteLink to="/signup">Create an account</RouteLink>
          <RouteLink to="/forgot-password">Forgot password?</RouteLink>
        </>
      ) : (
        <RouteLink to="/login">Back to sign in</RouteLink>
      )}
    </Screen>
  );
}
