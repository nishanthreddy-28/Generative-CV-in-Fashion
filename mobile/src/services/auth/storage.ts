type KeyStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

// Separate chunks avoid native SecureStore per-item limits. Two slots let
// the manifest switch only after a complete write.
export function secureSessionStorage(store: KeyStore) {
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>) {
    const next = pending.then(operation);
    pending = next.catch(() => undefined);
    return next;
  }

  async function manifest(key: string) {
    const raw = await store.get(key);
    const match = /^(0|1):([1-9][0-9]?)$/.exec(raw ?? "");
    return match ? { slot: Number(match[1]), count: Number(match[2]) } : null;
  }
  const chunkKey = (key: string, slot: number, index: number) =>
    `${key}.${slot}.${index}`;
  async function erase(key: string, slot: number) {
    const lengthKey = chunkKey(key, slot, 0);
    const count = Number(await store.get(lengthKey));
    for (let i = 1; i <= Math.min(count, 99); i++)
      await store.remove(chunkKey(key, slot, i));
    await store.remove(lengthKey);
  }

  return {
    getItem: (key: string) => serialize(async () => {
      const saved = await manifest(key);
      if (!saved) return null;
      let value = "";
      for (let i = 1; i <= saved.count; i++) {
        const chunk = await store.get(chunkKey(key, saved.slot, i));
        if (chunk === null) return null;
        value += chunk;
      }
      return value;
    }),
    setItem: (key: string, value: string) => serialize(async () => {
      const saved = await manifest(key);
      const slot = saved?.slot === 0 ? 1 : 0;
      // At most 1,536 UTF-8 bytes per chunk even for non-ASCII strings.
      const chunks = value.match(/[\s\S]{1,384}/gu) ?? [""];
      if (chunks.length > 99) throw new Error("Session exceeds the device storage limit.");
      await erase(key, slot);
      await store.set(chunkKey(key, slot, 0), String(chunks.length));
      for (const [index, chunk] of chunks.entries())
        await store.set(chunkKey(key, slot, index + 1), chunk);
      await store.set(key, `${slot}:${chunks.length}`);
      if (saved) await erase(key, saved.slot).catch(() => undefined);
    }),
    removeItem: (key: string) => serialize(async () => {
      await store.remove(key);
      await erase(key, 0);
      await erase(key, 1);
    }),
  };
}
