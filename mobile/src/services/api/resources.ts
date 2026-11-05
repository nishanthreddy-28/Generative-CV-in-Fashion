import { apiRequest, type RequestOptions } from "./client";
import type { User, Session } from "../../types/domain";
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<Session>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  signup: (name: string, email: string, password: string) =>
    apiRequest<{ message: string }>("/auth/signup", {
      method: "POST",
      body: { name, email, password },
    }),
  reset: (email: string) =>
    apiRequest<{ message: string }>("/auth/password-reset", {
      method: "POST",
      body: { email },
    }),
  me: (token: string) => apiRequest<User>("/auth/me", { token }),
};
export const resourceApi = <T>(path: string, options: RequestOptions = {}) =>
  apiRequest<T>(path, options);
