import {
  createContext,
  useCallback,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { authApi } from "../services/api/resources";
import { apiRequest, ApiError, type RequestOptions } from "../services/api/client";
import type { Session } from "../types/domain";
type Context = {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  expire: () => void;
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
};
const SessionContext = createContext<Context | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const expire = useCallback(() => setSession(null), []);
  async function login(email: string, password: string) {
    const value = await authApi.login(email.trim(), password);
    if (
      !value.accessToken ||
      !value.user?.id ||
      !["user", "admin"].includes(value.user.role)
    )
      throw new Error(
        "The sign-in response is incomplete. Please contact support.",
      );
    setSession(value);
  }
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!session) throw new ApiError("Sign in to continue.", 401);
    try { return await apiRequest<T>(path, { ...options, token: session.accessToken }); }
    catch (error) { if (error instanceof ApiError && error.status === 401) expire(); throw error; }
  }
  async function logout() {
    try {
      if (session)
        await apiRequest<void>("/auth/logout", {
          method: "POST",
          token: session.accessToken,
        });
    } finally {
      setSession(null);
    }
  }
  return (
    <SessionContext.Provider value={{ session, login, logout, expire, request }}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
