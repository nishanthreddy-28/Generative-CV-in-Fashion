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
    <Screen title="Confirm your email.">
      {session ? (
        <RouteLink to={accountDeleting ? "/account-deletion" : "/dashboard"}>Continue</RouteLink>
      ) : supabase && hash ? (
        <Button label="Confirm email" loading={busy} disabled={!ready || busy} onPress={confirm} />
      ) : (
        <Notice title="Confirmation unavailable" text={supabase
          ? "Open a fresh confirmation link from your email."
          : "Supabase sign-in is not configured."} />
      )}
      {!!message && <Notice title="Confirmation status" text={message} />}
      {!session && <RouteLink to="/signup">Request a fresh verification email</RouteLink>}
      <RouteLink to="/login">Back to sign in</RouteLink>
    </Screen>
  );
}
