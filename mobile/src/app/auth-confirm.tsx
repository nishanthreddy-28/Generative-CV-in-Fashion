import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../components/Button";
import { Notice, RouteLink, Screen } from "../components/Screen";
import { emailLinkHash, verifyEmailLink } from "../services/auth/contracts";
import { createEmailLinkAuth, supabase } from "../services/auth/supabase";

export default function ConfirmEmail() {
  const { token_hash } = useLocalSearchParams();
  const hash = emailLinkHash(token_hash);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (!hash || busy) return;
    setBusy(true);
    try {
      const auth = createEmailLinkAuth();
      await verifyEmailLink(auth, hash, "email");
      await auth.signOut({ scope: "local" }).catch(() => undefined);
      router.replace("/login");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Confirm your email.">
      {supabase && hash && !failed ? (
        <Button label="Confirm email" loading={busy} onPress={confirm} />
      ) : (
        <Notice title="Confirmation unavailable" text={supabase
          ? "Open a fresh confirmation link from your email."
          : "Supabase sign-in is not configured."} />
      )}
      <RouteLink to="/login">Back to sign in</RouteLink>
    </Screen>
  );
}
