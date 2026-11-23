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
  if (code === "email_address_invalid" || code === "validation_failed")
    return "Check the email address and try again.";
  if (code === "email_address_not_authorized") return "Email delivery is not yet configured for this address. Please contact support.";
  if (code === "signup_disabled") return "Registration is currently unavailable.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit")
    return "Too many requests. Try again later.";
  return "Authentication could not be completed. Try again.";
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

export const registrationMessage =
  "If this address can be registered, you’ll receive a verification link. If you already have an account, sign in or reset your password.";

export async function resendSignupEmail(auth: Pick<Auth,"resend">, email: string, redirect: string) {
  const { error } = await auth.resend({
    type: "signup", email: email.trim(), options: { emailRedirectTo: redirect },
  });
  if (error && !["user_not_found","user_already_exists","email_exists"].includes(error.code ?? ""))
    throw new Error(authError(error.code));
}

export async function signIn(auth: Pick<Auth, "signInWithPassword">, email: string, password: string) {
  const { data, error } = await auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.session) throw new Error(authError(error?.code));
  return data.session;
}

export async function register(
  auth: Pick<Auth, "signUp" | "signOut">, email: string, password: string, redirect: string,
) {
  const { data, error } = await auth.signUp({
    email: email.trim(), password,
    options: { emailRedirectTo: redirect },
  });
  if (error && !["user_already_exists","email_exists"].includes(error.code ?? ""))
    throw new Error(authError(error.code));
  if (data.session) {
    await auth.signOut({scope:"local"}).catch(() => undefined);
    throw new Error("Email verification is not configured correctly. Please contact support.");
  }
}

export async function verifyEmailLink(
  auth: Pick<Auth, "verifyOtp">, value: unknown, type: "email" | "signup" | "recovery",
) {
  const hash = emailLinkHash(value);
  if (!hash) throw new Error("Invalid email link.");
  const { data, error } = await auth.verifyOtp({ token_hash: hash, type });
  if (error || !data.session) throw new Error("This email link is invalid or expired.");
  if (type === "signup" && !data.session.user.email_confirmed_at)
    throw new Error("This email could not be confirmed. Request a fresh link.");
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

export function oauthCallbackIssue(code: unknown, flowId: unknown, error: unknown, errorCode: unknown) {
  if (error === "access_denied" || errorCode === "access_denied") return "Sign-in cancelled";
  if (error || errorCode || typeof code !== "string" || !code || code.length > 2048 ||
      typeof flowId !== "string" || !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId))
    return "Sign-in unavailable";
  return null;
}

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
