import { useCallback, useEffect, useState } from "react";
import { useSession } from "../features/session";
import { ApiError } from "../services/api/client";
import { resourceApi } from "../services/api/resources";
export function useResource<T>(path: string, preview: boolean, admin = false) {
  const { session, expire } = useSession();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const retry = useCallback(() => setRevision((n) => n + 1), []);
  const token = session?.accessToken;
  const skip = preview || !token || (admin && session?.user.role !== "admin");
  const key = JSON.stringify([path, token, revision]);
  useEffect(() => {
    if (skip) return;
    const controller = new AbortController();
    resourceApi<T>(path, { token, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) expire();
        setState({
          key,
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load your data.",
        });
      });
    return () => controller.abort();
  }, [path, token, key, skip, expire]);
  return {
    data: !skip && state.key === key ? state.data : null,
    error: !skip && state.key === key ? state.error : "",
    loading: !skip && state.key !== key,
    retry,
  };
}
