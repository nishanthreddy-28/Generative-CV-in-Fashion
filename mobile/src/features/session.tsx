import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { apiRequest, ApiError, type RequestOptions } from "../services/api/client";
import { resolveCustomerAccess } from "../services/auth/customerAccess";
import { accountRequestAllowed, exchangeOAuth, currentAccessToken, signIn } from "../services/auth/contracts";
import { clearPersistedSession, requireAuth, supabase } from "../services/auth/supabase";
import { draftStore } from "./draftStore";
import type { Session } from "../types/domain";

type Context = {
  session: Session | null;
  ready: boolean;
  accountDeleting: boolean;
  sessionIssue: string;
  deleteAccount: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOAuth: (code: string, flowId?: string) => Promise<void>;
  request: <T>(path: string, options?: Omit<RequestOptions, "token">) => Promise<T>;
};

const SessionContext = createContext<Context | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [candidate,setCandidate]=useState<AuthSession|null>(null);
  const [sessionIssue,setSessionIssue]=useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const identity = useRef<{ id: string } | null>(null);
  const signedOut = useRef(false);
  const deleting = useRef(false);
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [permissionRevision, setPermissionRevision] = useState(0);

  const applySession = useCallback((next: AuthSession | null) => {
    setCandidate(next);
    setSessionIssue("");
    setPermissionRevision((value) => value + 1);
    const user = next?.user;
    const id = signedOut.current ? undefined : user?.id;
    if (identity.current?.id !== id) {
      draftStore.clear();
      deleting.current = false;
      setAccountDeleting(false);
      identity.current = id ? { id } : null;
      setSession(null);
    }
    if (!id) setSession(null);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const auth = supabase.auth;
    const { data: { subscription } } = auth.onAuthStateChange((event, next) => {
      // Keep this callback synchronous. The SDK may hold its auth lock here.
      if (event === "SIGNED_IN" && !signedOut.current) applySession(next);
      else if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" ||
               event === "SIGNED_OUT" || event === "USER_UPDATED") applySession(next);
      if (event === "INITIAL_SESSION" && !next) setReady(true);
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

  const admitSession = useCallback(async (next: AuthSession) => {
    signedOut.current = false;
    applySession(next);
    const caller = identity.current;
    const access = await resolveCustomerAccess(path => apiRequest(path, {token: next.access_token}), next.user.id);
    if (identity.current !== caller) throw new Error("Account changed during sign-in.");
    deleting.current = access.deleting;
    setAccountDeleting(access.deleting);
    setSession({user:{id:next.user.id,email:next.user.email ?? "",role:access.role}});
    if (AppState.currentState === "active") void requireAuth().startAutoRefresh();
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    await admitSession(await signIn(requireAuth(), email, password));
  }, [admitSession]);

  const completeOAuth = useCallback(async (code: string, flowId?: string) => {
    const auth = requireAuth();
    const next = await exchangeOAuth(auth, code, flowId);
    try {
      await admitSession(next);
    } catch (error) {
      if (identity.current?.id === next.user.id) {
        signedOut.current = true;
        applySession(null);
        await auth.signOut({scope:"local"}).catch(() => undefined);
      }
      throw error;
    }
  }, [admitSession, applySession]);

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
    if (!accountRequestAllowed(deleting.current, path, options?.method)) throw new ApiError("Account deletion is pending. Check deletion progress.", 403);
    const token = await currentAccessToken(
      () => auth.getSession(), caller.id,
      () => identity.current === caller && !options?.signal?.aborted,
    );
    if (!token) throw new ApiError("Unable to use this session. Sign in again or retry.", 401);
    const result = await apiRequest<T>(path, { ...options, token });
    if (identity.current !== caller) throw new ApiError("Account changed during the request.", 401);
    if (!accountRequestAllowed(deleting.current, path, options?.method)) throw new ApiError("Account deletion is pending.", 403);
    return result;
  }, []);

  const deleteAccount = useCallback(async () => {
    const caller = identity.current;
    await request<void>("/account", { method: "DELETE", body: { confirmation: "DELETE" } });
    if (identity.current !== caller) throw new ApiError("Account changed during deletion.", 401);
    deleting.current = true;
    setAccountDeleting(true);
    draftStore.clear();
  }, [request]);

  useEffect(() => {
    const caller=identity.current;
    if(!candidate || !caller || !supabase)return;
    const controller=new AbortController();
    const read=async (path:string)=>{
      const token=await currentAccessToken(()=>requireAuth().getSession(),caller.id,
        ()=>identity.current===caller && !controller.signal.aborted);
      if(!token)throw new ApiError("Sign in again.",401);
      return apiRequest<unknown>(path,{token,signal:controller.signal});
    };
    void resolveCustomerAccess(read,caller.id).then(access=>{
      if(controller.signal.aborted || identity.current!==caller)return;
      deleting.current=access.deleting;setAccountDeleting(access.deleting);
      setSession({user:{id:caller.id,email:candidate.user.email ?? "",role:access.role}});
    }).catch(error=>{
      if(controller.signal.aborted || identity.current!==caller)return;
      setSession(null);draftStore.clear();
      setSessionIssue(error instanceof Error ? error.message : "Account access is unavailable.");
    }).finally(()=>{if(!controller.signal.aborted)setReady(true);});
    return ()=>controller.abort();
  },[candidate,permissionRevision]);

  return (
    <SessionContext.Provider value={{ session, ready, sessionIssue, accountDeleting, deleteAccount, login, logout, completeOAuth, request }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
