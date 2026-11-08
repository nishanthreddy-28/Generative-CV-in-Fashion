import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { publicAuthConfig } from "./contracts";
import { secureSessionStorage } from "./storage";

const config = publicAuthConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim(),
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
);
const native = Platform.OS !== "web";
// Supply the primitives the SDK needs for S256 on Expo runtimes without WebCrypto.
if (native && config && !globalThis.crypto?.subtle) {
  const crypto = globalThis.crypto ?? {};
  Object.assign(crypto, {
    getRandomValues: Crypto.getRandomValues,
    subtle: {
      digest: (algorithm: string, bytes: Uint8Array) => {
        if (algorithm !== "SHA-256") throw new Error("Unsupported digest algorithm.");
        return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes));
      },
    },
  });
  if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: crypto });
}
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const storage = native ? secureSessionStorage({
  get: (key) => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: (key) => SecureStore.deleteItemAsync(key, options),
}) : undefined;

export const sessionKey = config ? `drapedrop.${new URL(config.url).hostname}.session` : "";
export const clearPersistedSession = () => storage?.removeItem(sessionKey);
export const supabase = config && createClient(config.url, config.key, {
  auth: {
    storage, storageKey: sessionKey, persistSession: native,
    autoRefreshToken: false, detectSessionInUrl: false,
    flowType: "pkce",
  },
});

export function requireAuth() {
  if (!supabase) throw new Error("Supabase sign-in is not configured.");
  return supabase.auth;
}

// An email-link credential is confined to this screen and never persisted or
// shared with the application session used for FastAPI.
export function createEmailLinkAuth() {
  if (!config) throw new Error("Supabase sign-in is not configured.");
  return createClient(config.url, config.key, {
    auth: {
      storageKey: `${sessionKey}.email-link`, persistSession: false,
      autoRefreshToken: false, detectSessionInUrl: false,
    },
  }).auth;
}

export function emailRedirect(path: "auth-confirm" | "reset-password") {
  return native ? `drapedrop://${path}` : `${window.location.origin}/${path}`;
}
