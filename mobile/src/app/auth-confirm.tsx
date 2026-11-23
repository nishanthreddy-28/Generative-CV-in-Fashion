import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../components/Button";
import { Notice, RouteLink, Screen } from "../components/Screen";
import { emailLinkHash } from "../services/auth/contracts";
import { supabase } from "../services/auth/supabase";
import { useSession } from "../features/session";

export default function ConfirmEmail() {
  const { token_hash, type, error } = useLocalSearchParams();
  const hash = type === "signup" && !error ? emailLinkHash(token_hash) : null;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const { completeEmailConfirmation, ready, session, accountDeleting } = useSession();

  async function confirm() {
    if (!hash || !ready || session || submitting.current) return;
    submitting.current = true;
    setMessage("");
    setBusy(true);
    try {
      await completeEmailConfirmation(hash);
      router.replace("/profile/onboarding");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Email confirmation was unsuccessful.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen title={hash ? "Confirm your email." : "Continue to your wardrobe."}>
      {session ? (
        <RouteLink to={accountDeleting ? "/account-deletion" : "/dashboard"}>Continue</RouteLink>
      ) : supabase && hash ? (
        <Button label="Confirm email" loading={busy} disabled={!ready || busy} onPress={confirm} />
      ) : supabase && !error ? (
        <>
          <Notice title="Finish signing in" text="If you opened the confirmation link from your email, sign in with your email and password to continue. Your account will open only after Supabase confirms your email." />
          <RouteLink to="/login">Sign in to continue</RouteLink>
        </>
      ) : (
        <Notice title="Confirmation unavailable" text={supabase
          ? "This confirmation link could not be accepted. Request a fresh email."
          : "Supabase sign-in is not configured."} />
      )}
      {!!message && <Notice title="Confirmation status" text={message} />}
      {!session && <RouteLink to="/signup">Request a fresh verification email</RouteLink>}
      <RouteLink to="/login">Back to sign in</RouteLink>
    </Screen>
  );
}
