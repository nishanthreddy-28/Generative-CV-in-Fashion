import type { SupabaseClient } from "@supabase/supabase-js";

export function publicAuthConfig(url?: string, key?: string) {
  if (!url || !key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
        endpoint.pathname !== "/" || endpoint.search || endpoint.hash) return null;
    return { url: endpoint.origin, key };
  } catch {
    return null;
  }
}

export function emailLinkHash(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(value)
    ? value
    : null;
}

export function authError(code?: string) {
  if (code === "email_not_confirmed") return "Confirm your email before signing in.";
  if (code === "invalid_credentials") return "Email or password is incorrect.";
  if (code === "weak_password") return "Choose a stronger password.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit")
    return "Too many requests. Try again later.";
  return "Authentication could not be completed. Try again.";
}

export function signupMessage(hasSession: boolean) {
  return hasSession
    ? "You’re signed in. Application access depends on account setup."
    : "Check your email to confirm your address before signing in.";
}

type TokenSession = { user: { id: string }; access_token: string; expires_at?: number };

export async function currentAccessToken(
  read: () => Promise<{ data: { session: TokenSession | null }; error: unknown }>,
  expectedUser: string,
  stillCurrent: () => boolean,
) {
  const { data, error } = await read();
  const session = data.session;
  if (error || !stillCurrent() || session?.user.id !== expectedUser ||
      !session.access_token || !session.expires_at ||
      session.expires_at <= Date.now() / 1000) return null;
  return session.access_token;
}

type Auth = SupabaseClient["auth"];

export async function signIn(auth: Pick<Auth, "signInWithPassword">, email: string, password: string) {
  const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.session) throw new Error(authError(error?.code));
  return data.session;
}

export async function register(
  auth: Pick<Auth, "signUp">, name: string, email: string, password: string, redirect: string,
) {
  const { data, error } = await auth.signUp({
    email: email.trim(), password,
    options: { data: { name: name.trim() }, emailRedirectTo: redirect },
  });
  if (error) throw new Error(authError(error.code));
  return data.session;
}

export async function verifyEmailLink(
  auth: Pick<Auth, "verifyOtp">, value: unknown, type: "email" | "recovery",
) {
  const hash = emailLinkHash(value);
  if (!hash) throw new Error("Invalid email link.");
  const { data, error } = await auth.verifyOtp({ token_hash: hash, type });
  if (error || !data.session) throw new Error("This email link is invalid or expired.");
  return data.session;
}

export function protectedScreenState(
  preview: boolean, ready: boolean, role: "user" | "admin" | undefined, admin: boolean,
) {
  if (preview) return "open";
  if (!ready) return "restoring";
  if (!role) return "signed-out";
  if (admin && role !== "admin") return "forbidden";
  return "open";
}

// Display permission only. Every admin API operation independently checks membership.
export function catalogRole(value: unknown, userId: string): "user" | "admin" {
  if (!value || typeof value !== "object") return "user";
  const access = value as Record<string, unknown>;
  return access.userId === userId && access.isCatalogAdmin === true ? "admin" : "user";
}
