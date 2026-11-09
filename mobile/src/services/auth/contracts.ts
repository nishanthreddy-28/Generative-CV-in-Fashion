import type { SupabaseClient } from "@supabase/supabase-js";

export function publicAuthConfig(url?: string, key?: string, localPreview = false) {
  if (!url || !key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  try {
    const endpoint = new URL(url);
    if (localPreview && endpoint.origin !== "http://127.0.0.1:54321") return null;
    if ((!localPreview && endpoint.protocol !== "https:") || endpoint.username || endpoint.password ||
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
  _preview: boolean, ready: boolean, role: "user" | "admin" | undefined, admin: boolean,
) {
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

export async function reauthenticate(
  auth: Pick<Auth, "signInWithPassword">, email: string, password: string, expectedUser: string,
) {
  const session = await signIn(auth,email,password);
  if(session.user.id!==expectedUser)throw new Error("Account changed during confirmation. Sign out and retry.");
  return session;
}

export async function exchangeOAuth(
  auth: Pick<Auth, "exchangeCodeForSession">, code: string, flowId?: string,
) {
  if (!code || code.length > 2048 || (!flowId || !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId)))
    throw new Error("Invalid sign-in callback. Start sign-in again.");
  const { data, error } = await auth.exchangeCodeForSession(code, { flowId });
  if (error || !data.session) throw new Error("Sign-in link is invalid or expired. Start sign-in again.");
  return data.session;
}

export type SocialProvider = "google" | "apple";

export async function beginSocialOAuth(auth: Pick<Auth,"signInWithOAuth">, provider: SocialProvider, redirectTo: string) {
  const {data,error}=await auth.signInWithOAuth({provider,options:{redirectTo,skipBrowserRedirect:true}});
  if(error || !data.url || !data.flowId || !/^[a-zA-Z0-9_-]{8,64}$/.test(data.flowId))
    throw new Error("Social sign-in is unavailable. Check provider and callback configuration.");
  // Installed SDK returns per-flow verifier identity; bind it to this callback only.
  const callback=new URL(redirectTo);
  callback.searchParams.set("sb_flow_id",data.flowId);
  const target=new URL(data.url);
  target.searchParams.set("redirect_to",callback.toString());
  return target;
}

export const beginGoogleOAuth = (auth: Pick<Auth,"signInWithOAuth">, redirectTo: string) =>
  beginSocialOAuth(auth, "google", redirectTo);

export function accountRequestAllowed(deleting: boolean, path: string, method = "GET") {
  return !deleting || (path === "/account/deletion" && method === "GET");
}
