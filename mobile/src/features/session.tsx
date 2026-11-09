import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { apiRequest, ApiError, type RequestOptions } from "../services/api/client";
import { exchangeOAuth, catalogRole, currentAccessToken, register, signIn } from "../services/auth/contracts";
import { clearPersistedSession, emailRedirect, requireAuth, supabase } from "../services/auth/supabase";
import { draftStore } from "./draftStore";
import type { Session } from "../types/domain";

type Context = {
  session: Session | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  completeOAuth: (code: string, flowId?: string) => Promise<void>;
  request: <T>(path: string, options?: Omit<RequestOptions, "token">) => Promise<T>;
};

const SessionContext = createContext<Context | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const identity = useRef<{ id: string } | null>(null);
  const signedOut = useRef(false);
  const [permissionRevision, setPermissionRevision] = useState(0);

  const applySession = useCallback((next: AuthSession | null) => {
    setPermissionRevision((value) => value + 1);
    const user = next?.user;
    const id = signedOut.current ? undefined : user?.id;
    if (identity.current?.id !== id) {
      draftStore.clear();
      identity.current = id ? { id } : null;
    }
    if (!id || !user) {
      setSession(null);
      return;
    }
    setSession((previous) => previous?.user.id === id && previous.user.email === user.email
      ? previous
      : { user: { id, email: user.email ?? "", role: "user" } });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const auth = supabase.auth;
    const { data: { subscription } } = auth.onAuthStateChange((event, next) => {
      // Keep this callback synchronous. The SDK may hold its auth lock here.
      if (event === "SIGNED_IN" && !signedOut.current) applySession(next);
      else if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" ||
               event === "SIGNED_OUT" || event === "USER_UPDATED") applySession(next);
      if (event === "INITIAL_SESSION") setReady(true);
    });
    function updateRefresh(state: string) {
      if (state === "active" && !signedOut.current) {
        setPermissionRevision((value) => value + 1);
        void auth.startAutoRefresh();
      }
      else void auth.stopAutoRefresh();
    }
    updateRefresh(AppState.currentState ?? "unknown");
    const lifecycle = AppState.addEventListener("change", updateRefresh);
    return () => {
      subscription.unsubscribe();
      lifecycle.remove();
      void auth.stopAutoRefresh();
    };
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    const auth = requireAuth();
    const next = await signIn(auth, email, password);
    signedOut.current = false;
    applySession(next);
    if (AppState.currentState === "active") void auth.startAutoRefresh();
  }, [applySession]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const auth = requireAuth();
    const next = await register(auth, name, email, password, emailRedirect("auth-confirm"));
    if (next) {
      signedOut.current = false;
      applySession(next);
      if (AppState.currentState === "active") void auth.startAutoRefresh();
    }
    return Boolean(next);
  }, [applySession]);

  const completeOAuth = useCallback(async (code: string, flowId?: string) => {
    const auth = requireAuth();
    const next = await exchangeOAuth(auth, code, flowId);
    signedOut.current = false;
    applySession(next);
    if (AppState.currentState === "active") void auth.startAutoRefresh();
  }, [applySession]);

  const logout = useCallback(async () => {
    signedOut.current = true;
    setReady(false);
    applySession(null);
    try {
      const auth = requireAuth();
      await auth.stopAutoRefresh();
      const { error } = await auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      try {
        await clearPersistedSession();
      } catch {
        throw new Error("Session storage could not be cleared. Retry sign-out before closing the app.");
      }
      throw new Error("This device was signed out locally. Server sign-out could not be confirmed.");
    } finally {
      setReady(true);
    }
  }, [applySession]);

  const request = useCallback(async <T,>(path: string, options?: Omit<RequestOptions, "token">) => {
    const caller = identity.current;
    const auth = supabase?.auth;
    if (!caller || !auth) throw new ApiError("Sign in to continue.", 401);
    const token = await currentAccessToken(
      () => auth.getSession(), caller.id,
      () => identity.current === caller && !options?.signal?.aborted,
    );
    if (!token) throw new ApiError("Unable to use this session. Sign in again or retry.", 401);
    const result = await apiRequest<T>(path, { ...options, token });
    if (identity.current !== caller) throw new ApiError("Account changed during the request.", 401);
    return result;
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const controller = new AbortController();
    // Failure is fail-closed for UI access; no role is read from Auth metadata.
    void request<unknown>("/admin/catalog/access", { signal: controller.signal })
      .then((access) => {
        if (!controller.signal.aborted) setSession((current) => current?.user.id === userId
          ? { user: { ...current.user, role: catalogRole(access, userId) } } : current);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSession((current) => current?.user.id === userId
          ? { user: { ...current.user, role: "user" } } : current);
      });
    return () => controller.abort();
  }, [session?.user.id, permissionRevision, request]);

  return (
    <SessionContext.Provider value={{ session, ready, login, signup, logout, completeOAuth, request }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
