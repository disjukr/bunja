export interface StoragePort { setItem(key: string, value: string): void }
export function createScreenFactory(config: {
  endpoint: string; storage: StoragePort; storageKey: string;
  fetcher: (url: string) => Promise<unknown>;
}) {
  // Capture one immutable dependency set per screen owner, outside rendering.
  const { endpoint, storage, storageKey, fetcher } = config;
  return function screen() {
    let filter = '';
    return {
      setFilter(v: string) { filter = v; storage.setItem(storageKey, v); },
      load() { return fetcher(endpoint + '?q=' + filter); },
    };
  };
}

export function createSearch(rpc: { load(): Promise<string> }) {
  let active = false, lifetime = 0, request = 0;
  let result = '', error: unknown;
  function mount() {
    if (active) throw new Error('Search owner already mounted');
    active = true;
    const owner = ++lifetime;
    return () => {
      if (!active || lifetime !== owner) return;
      active = false; ++lifetime; ++request;
    };
  }
  async function refresh() {
    if (!active) return;
    const owner = lifetime, version = ++request;
    const current = () => active && lifetime === owner && request === version;
    try {
      const value = await rpc.load();
      if (current()) { result = value; error = undefined; }
    } catch (cause) {
      if (current()) error = cause;
    }
  }
  return { mount, refresh, snapshot: () => ({ result, error }) };
}
