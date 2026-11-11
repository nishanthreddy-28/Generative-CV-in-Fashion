import { registrationOrigin, registrationRequest, validBinding, type RegistrationBinding } from "../services/auth/registration";
import { retainRegistration } from "../services/auth/registrationStorage";
import {AtelierAccount} from "./AtelierAccount";
import {SocialSignIn} from "./SocialSignIn";
import {useAppearance, type Palette} from "../theme/Appearance";
import {Link, router} from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { Screen, ui } from "../components/Screen";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { type Field, validate } from "./validation";
import { useSession } from "./session";
import { emailRedirect, requireAuth, supabase } from "../services/auth/supabase";
import { beginSocialOAuth, type SocialProvider, authError } from "../services/auth/contracts";
const localPreview = __DEV__ && process.env.EXPO_PUBLIC_LOCAL_PREVIEW === "true";
const reviewOnly = process.env.EXPO_PUBLIC_REVIEW_ONLY === "true";
const registrationBase=process.env.EXPO_PUBLIC_REGISTRATION_API_URL ?? "";
const registrationEnabled=!reviewOnly && !!registrationOrigin(registrationBase, localPreview);

export function AuthScreen({ mode }: { mode: "login" | "signup" | "reset" }) {
  const {palette:atelier,mode:appearance}=useAppearance();
  const styles=makeStyles(atelier);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const { login, session, sessionIssue, ready } = useSession();
  const fields: Field[] = [
    { key: "email", label: "Email", required: true, kind: "email" },
    ...(mode === "login" ? [{
      key: "password", label: "Password", required: true,
      kind: "password" as const, passwordPurpose: "current" as const,
    }] : []),
  ];
  async function submit() {
    const issues = validate(fields, values);
    setErrors(issues);
    setMessage("");
    setSuccess(false);
    if (Object.keys(issues).length) return;
    if (mode === "signup" && !registrationEnabled) {
      setMessage("Registration is unavailable while email verification is being configured.");
      return;
    }
    if (reviewOnly) {
      setMessage(mode === "reset" ? "Password recovery is temporarily unavailable. Please try again later." : "Sign-in is temporarily unavailable. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const binding=await registrationRequest<RegistrationBinding>(registrationBase,"start",{email:values.email.trim()},localPreview);
        if(!validBinding(binding))throw new Error("Unexpected registration response.");
        await retainRegistration(binding);
        setValues({});
        router.push("/verify-registration");
      } else if (mode === "login") {
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
  async function social(provider:SocialProvider){
    if(busy)return;setBusy(true);setMessage("");
    try{
      const target=await beginSocialOAuth(requireAuth(),provider,emailRedirect("oauth-callback"));
      const origin=new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").origin;
      if(target.origin!==origin || !target.pathname.startsWith("/auth/v1/"))throw new Error("Unexpected sign-in destination.");
      if(Platform.OS==="web")window.location.assign(target.href);else await Linking.openURL(target.href);
    }catch(e){setMessage(e instanceof Error ? e.message : "Unable to start social sign-in.");}
    finally{setBusy(false);}
  }
  const branded = mode !== "reset";
  const dark = branded && appearance === "dark";
  const form = (
        <View style={[styles.form,branded && styles.editorialForm]}>
          {branded && <SocialSignIn busy={busy} onPress={provider=>void social(provider)}/>}
          {session && (
            <Link href="/dashboard" style={branded ? styles.darkLink : ui.link}>Continue to your dashboard</Link>
          )}
          {(reviewOnly || !supabase) && mode !== "signup" && <Text style={branded ? styles.feedback : ui.body}>
            {mode === "reset" ? "Password recovery is temporarily unavailable." : "Sign-in is temporarily unavailable."}
          </Text>}
          {!!sessionIssue && <Text accessibilityRole="alert" style={branded ? styles.feedback : ui.error}>{sessionIssue}</Text>}
          <Fields
            dark={dark}
            editorial={branded}
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
          {mode === "signup" && !registrationEnabled &&
            <Text style={styles.feedback}>Registration opens when email verification is ready.</Text>}
          {Boolean(message) && (
            <Text accessibilityRole="alert" style={[success ? ui.body : ui.error,branded && {color:success ? atelier.ink : atelier.error}]}>
              {message}
            </Text>
          )}
          <Button
            dark={dark}
            label={
              mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? registrationEnabled ? "Send verification email" : "Registration opens soon"
                  : "Send reset instructions"
            }
            loading={busy}
            disabled={!ready || busy || (mode === "signup" ? !registrationEnabled : (!reviewOnly && !supabase))}
            onPress={submit}
          />

          {mode === "login" ? (
            <Link href="/forgot-password" style={styles.accountLink}>Forgot password?</Link>
          ) : (
            <>
              {mode === "signup" && registrationEnabled &&
                <Link href="/verify-registration" style={styles.accountLink}>Already received an email? Continue verification →</Link>}
              {mode === "reset" && <Link href="/login" style={ui.link}>Back to sign in</Link>}
            </>
          )}
        </View>
  );
  if (mode === "reset") return <Screen title="Reset password" subtitle="Enter your account email to request a reset link.">{form}</Screen>;
  return <AtelierAccount accountMode={mode}
    title={mode === "login" ? "Sign in" : "Create your wardrobe"}
    subtitle={mode === "login" ? "Your clothes and saved looks are ready when you are." :
      "Start with your email. We’ll send a link and a separate code before you choose a password."}>
    {form}
  </AtelierAccount>;
}

const makeStyles = (atelier:Palette) => StyleSheet.create({
  form: { gap: 12 },
  feedback:{fontSize:13,lineHeight:20,color:atelier.muted,borderLeftWidth:2,borderColor:atelier.accent,paddingLeft:12},
  editorialForm:{backgroundColor:atelier.surface,borderWidth:1,borderColor:atelier.border,padding:14},
  darkLink:{color:atelier.ink,fontSize:13,paddingVertical:12,minHeight:44,textDecorationLine:"underline"},
  accountLink:{color:atelier.ink,fontSize:13,paddingVertical:12,minHeight:44,textDecorationLine:"underline",alignSelf:"flex-start"},
});
