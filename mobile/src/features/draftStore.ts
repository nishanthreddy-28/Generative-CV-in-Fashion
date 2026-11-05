/** Session-memory drafts only. Never write personal drafts or photos to localStorage. */
export function createDraftStore() {
  const values = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get<T>(key: string, fallback: T): T {
      return values.has(key) ? (values.get(key) as T) : fallback;
    },
    set<T>(key: string, value: T) {
      values.set(key, value);
      emit();
    },
    clear() {
      values.clear();
      emit();
    },
  };
}
export const draftStore = createDraftStore();
