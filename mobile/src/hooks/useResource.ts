import { useCallback, useEffect, useState } from "react";
import { useSession } from "../features/session";
export function useResource<T>(path: string, preview: boolean, admin = false, responseType?: "image") {
  const { session, request } = useSession();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const retry = useCallback(() => setRevision((n) => n + 1), []);
  const userId = session?.user.id;
  const skip = preview || !userId || (admin && session?.user.role !== "admin");
  const key = JSON.stringify([path, userId, revision, responseType]);
  useEffect(() => {
    if (skip) return;
    const controller = new AbortController();
    request<T>(path, { signal: controller.signal, responseType })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
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
  }, [path, key, skip, request, responseType]);
  return {
    data: !skip && state.key === key ? state.data : null,
    error: !skip && state.key === key ? state.error : "",
    loading: !skip && state.key !== key,
    retry,
  };
}
