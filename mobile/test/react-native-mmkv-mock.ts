const stores = new Map<string, Map<string, string>>();
function getStore(id: string): Map<string, string> {
  if (!stores.has(id)) stores.set(id, new Map());
  return stores.get(id)!;
}
export type MMKV = ReturnType<typeof createMMKV>;
export function createMMKV(config?: { id?: string }) {
  const store = getStore(config?.id ?? 'default');
  return {
    getString: (key: string) => store.get(key),
    set: (key: string, value: string) => store.set(key, value),
    remove: (key: string) => store.delete(key),
    getAllKeys: () => [...store.keys()],
    clearAll: () => store.clear(),
    contains: (key: string) => store.has(key),
    getNumber: (key: string) => { const v = store.get(key); return v !== undefined ? Number(v) : undefined; },
    getBoolean: (key: string) => { const v = store.get(key); return v !== undefined ? v === 'true' : undefined; },
  };
}
