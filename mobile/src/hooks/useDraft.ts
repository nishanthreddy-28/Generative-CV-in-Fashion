import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { useSession } from "../features/session";
import { draftStore } from "../features/draftStore";
/** Keeps non-password form drafts when a screen unmounts. Cleared on account changes. */
export function useDraft<T>(
  name: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const { session } = useSession();
  const [fallback] = useState(() => initial);
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const key = `${preview === "1" ? "preview" : (session?.user.id ?? "signed-out")}:${name}`;
  const snapshot = useCallback(
    () => draftStore.get(key, fallback),
    [key, fallback],
  );
  const value = useSyncExternalStore(draftStore.subscribe, snapshot, snapshot);
  const set: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      const current = draftStore.get(key, fallback);
      draftStore.set(
        key,
        typeof next === "function" ? (next as (value: T) => T)(current) : next,
      );
    },
    [key, fallback],
  );
  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      JSON.stringify(value) === JSON.stringify(fallback)
    )
      return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value, fallback]);
  return [value, set];
}
