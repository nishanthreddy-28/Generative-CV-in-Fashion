import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { beginGoogleOAuth, exchangeOAuth, reauthenticate, catalogRole, currentAccessToken, protectedScreenState, publicAuthConfig, register, signIn, signupMessage, verifyEmailLink } from "../src/services/auth/contracts.ts";
import { secureSessionStorage } from "../src/services/auth/storage.ts";
import { apiRequest } from "../src/services/api/client.ts";

const url = "https://auth.example.invalid";
const key = "sb_publishable_test";
const user = { id: "user-a", email: "a@example.invalid", aud: "authenticated" };
const expiry = () => Math.floor(Date.now() / 1000) + 3600;
function payload(accessToken = "access-first") {
  return { user, access_token: accessToken, refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer" };
}
function storageFixture() {
  const data = new Map();
  return secureSessionStorage({
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      assert.ok(Buffer.byteLength(value) <= 1536);
      data.set(key, value);
    },
    remove: async (key) => { data.delete(key); },
  });
}
function makeAuth(fetch, storage, storageKey = "app-test") {
  return createClient(url, key, {
    global: { fetch },
    auth: { storage, storageKey, persistSession: Boolean(storage), detectSessionInUrl: false, autoRefreshToken: false },
  }).auth;
}
const response = (body, status = 200) => Response.json(body, { status });

test("missing configuration and privileged credentials fail closed", () => {
  for (const invalid of [undefined, "", "sb_secret_test", "sbp_example", "legacy.jwt.key"])
    assert.equal(publicAuthConfig(url, invalid), null);
  assert.equal(publicAuthConfig(undefined, key), null);
  assert.equal(publicAuthConfig("http://example.invalid", key), null);
  assert.deepEqual(publicAuthConfig(url, key), { url, key });
});

test("signup submits only display metadata and handles confirmation-required signup", async () => {
  const auth = makeAuth(async (url, init) => {
    assert.equal(new URL(url).pathname, "/auth/v1/signup");
    assert.deepEqual(JSON.parse(init.body).data, { name: "A" });
    return response(user);
  });
  assert.equal(await register(auth, " A ", user.email, "test-password", "drapedrop://auth-confirm"), null);
  assert.match(signupMessage(false), /confirm your address/i);
});

test("login handles invalid credentials and unconfirmed email safely", async () => {
  for (const [code, message] of [
    ["invalid_credentials", /incorrect/], ["email_not_confirmed", /Confirm your email/],
  ]) {
    const auth = makeAuth(async () => response({ error_code: code, msg: "private provider response" }, 400));
    await assert.rejects(signIn(auth, user.email, "test-password"), message);
  }
});

test("SDK restores the persisted session and logout clears it", async () => {
  const storage = storageFixture();
  const fetch = async (url) => new URL(url).pathname.endsWith("/logout")
    ? new Response(null, { status: 204 }) : response(payload());
  const first = makeAuth(fetch, storage);
  assert.equal((await signIn(first, user.email, "test-password")).user.id, user.id);
  const restored = makeAuth(fetch, storage);
  const initial = await new Promise((resolve) => {
    const { data: { subscription } } = restored.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        subscription.unsubscribe();
        resolve(session);
      }
    });
  });
  assert.equal(initial?.access_token, "access-first");
  assert.equal((await restored.signOut({ scope: "local" })).error, null);
  assert.equal((await makeAuth(fetch, storage).getSession()).data.session, null);
});

test("concurrent SDK refresh reads use one refresh and FastAPI receives the new access token", async () => {
  let refreshes = 0;
  const auth = makeAuth(async (url) => {
    if (new URL(url).searchParams.get("grant_type") === "refresh_token") {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(payload("access-new"));
    }
    return response({ ...payload(), expires_in: 1 });
  });
  await signIn(auth, user.email, "test-password");
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_API_URL;
  try {
    process.env.EXPO_PUBLIC_API_URL = "https://fastapi.example.invalid";
    globalThis.fetch = async (_, init) => {
      assert.equal(init.headers.Authorization, "Bearer access-new");
      assert.ok(!JSON.stringify(init.headers).includes("test-refresh"));
      return response({});
    };
    await Promise.all(["/profile", "/settings"].map(async (path) => {
      const token = await currentAccessToken(() => auth.getSession(), user.id, () => true);
      assert.ok(token);
      await apiRequest(path, { token });
    }));
    assert.equal(refreshes, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalUrl;
  }
});

test("expired, invalid or superseded sessions cannot provide an API credential", async () => {
  const session = { user, access_token: "test-access", expires_at: expiry() };
  const expired = { ...session, expires_at: 1 };
  for (const [current, error, expectedUser, currentIdentity] of [
    [expired, null, user.id, true], [null, null, user.id, true],
    [session, new Error(), user.id, true], [session, null, "other", true],
    [session, null, user.id, false],
  ]) {
    assert.equal(await currentAccessToken(async () => ({ data: { session: current }, error }),
      expectedUser, () => currentIdentity), null);
  }
});

test("recovery link is verified with the recovery type and stays separate from the primary session", async () => {
  const primary = makeAuth(async () => response(payload()), undefined, "primary");
  await signIn(primary, user.email, "test-password");
  const link = makeAuth(async (url, init) => {
    assert.equal(new URL(url).pathname, "/auth/v1/verify");
    const { token_hash, type } = JSON.parse(init.body);
    assert.equal(token_hash, "test_hash_123456789");
    assert.equal(type, "recovery");
    return response(payload("recovery-only"));
  }, undefined, "link");
  await assert.rejects(verifyEmailLink(link, ["invalid", "duplicate"], "recovery"), /Invalid email link/);
  assert.equal((await verifyEmailLink(link, "test_hash_123456789", "recovery")).access_token, "recovery-only");
  assert.equal((await primary.getSession()).data.session.access_token, "access-first");
});

test("secure storage round trips large Unicode sessions and clears the active manifest", async () => {
  const storage = storageFixture();
  const large = "a".repeat(383) + "🧵".repeat(1800);
  await storage.setItem("session", large);
  assert.equal(await storage.getItem("session"), large);
  await storage.setItem("session", "rotated");
  assert.equal(await storage.getItem("session"), "rotated");
  await storage.removeItem("session");
  assert.equal(await storage.getItem("session"), null);
});


test("protected screens stay closed during restoration and after logout", () => {
  assert.equal(protectedScreenState(false, false, "user", false), "restoring");
  assert.equal(protectedScreenState(false, true, "user", false), "open");
  assert.equal(protectedScreenState(false, true, undefined, false), "signed-out");
  assert.equal(protectedScreenState(false, true, "user", true), "forbidden");
  assert.equal(protectedScreenState(true, false, undefined, true), "open");
});


test("catalog access is derived from a subject-bound backend projection, not editable metadata", () => {
  assert.equal(catalogRole({userId:"user-a",isCatalogAdmin:true},"user-a"),"admin");
  for (const value of [null,{}, {userId:"user-b",isCatalogAdmin:true},
    {userId:"user-a",isCatalogAdmin:"true"}, {userId:"user-a",user_metadata:{role:"admin"}},
    {userId:"user-a",role:"admin"}, {userId:"user-a",isCatalogAdmin:false}]) {
    assert.equal(catalogRole(value,"user-a"),"user");
  }
});


test("sensitive account confirmation reauthenticates the same identity", async()=>{
 const auth={signInWithPassword:async()=>({data:{session:{user:{id:"user-a"},access_token:"fresh"}},error:null})};
 assert.equal((await reauthenticate(auth,"a@example.invalid","secret-test","user-a")).access_token,"fresh");
 await assert.rejects(reauthenticate(auth,"a@example.invalid","secret-test","user-b"),/Account changed/);
});

test("web OAuth verifier survives redirect without persisting access or refresh tokens", async()=>{
 const {webAuthStorage}=await import('../src/services/auth/webStorage.ts');
 const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const before=webAuthStorage(storage);before.setItem('session','private-session');before.setItem('session-code-verifier','verifier');
 const after=webAuthStorage(storage);assert.equal(after.getItem('session'),null);assert.equal(after.getItem('session-code-verifier'),'verifier');
 after.removeItem('session-code-verifier');assert.equal(values.size,0);
});

test("real SDK PKCE redirect exchange restores only the verifier and returns a fresh session", async () => {
  const {webAuthStorage}=await import('../src/services/auth/webStorage.ts');
  const values=new Map();
  const verifiers={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const options=storage=>({global:{fetch:async (endpoint,init)=>{
    assert.equal(new URL(endpoint).searchParams.get('grant_type'),'pkce');
    const body=JSON.parse(init.body);
    assert.equal(body.auth_code,'fixture-oauth-code');
    assert.ok(body.code_verifier.length>=43);
    return response(payload('oauth-access'));
  }},auth:{storage,storageKey:'oauth-contract',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,flowType:'pkce'}});
  const first=createClient(url,key,options(webAuthStorage(verifiers))).auth;
  const redirect=await beginGoogleOAuth(first,'drapedrop://oauth-callback');
  assert.equal(redirect.searchParams.get('code_challenge_method'),'s256');
  assert.ok(values.has('oauth-contract-code-verifier'));
  const returned=createClient(url,key,options(webAuthStorage(verifiers))).auth;
  const flowId=new URL(redirect.searchParams.get('redirect_to')).searchParams.get('sb_flow_id');
  assert.ok(flowId);
  await assert.rejects(exchangeOAuth(returned,'fixture-oauth-code'),/Invalid sign-in callback/);
  await assert.rejects(exchangeOAuth(returned,'fixture-oauth-code','missing-flow-slot'),/invalid or expired/);
  const result=await exchangeOAuth(returned,'fixture-oauth-code',flowId);
  assert.equal(result.access_token,'oauth-access');
  assert.deepEqual([...values.keys()],[]);
});
