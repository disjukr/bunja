import { bunja, createScope } from "bunja";
import { atom, type createStore } from "jotai/vanilla";

export const StateStoreScope = createScope<ReturnType<typeof createStore>>();

export interface Service {
  load(signal: AbortSignal): Promise<string>;
  subscribe(): () => void;
}
export const ScreenScope = createScope<string>();
export const ServiceScope = createScope<Service>();

export interface StorageService {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const StorageScope = createScope<StorageService>();
export const preferences = bunja(() => {
  const screen = bunja.use(ScreenScope);
  const storage = bunja.use(StorageScope);
  const key = `filter:${screen}`;
  const stateStore = bunja.use(StateStoreScope);
  const filterAtom = atom(storage.getItem(key) ?? "");
  return {
    stateStore,
    filterAtom,
    set(value: string) {
      // Preserve storage errors rather than pretending persistence succeeded.
      storage.setItem(key, value);
      stateStore.set(filterAtom, value);
    },
  };
});

export const model = bunja.withSeed({ title: "" }, (seed) => {
  const screen = bunja.use(ScreenScope);
  const service = bunja.use(ServiceScope);
  const stateStore = bunja.use(StateStoreScope);
  const titleAtom = atom(seed.title);
  const errorAtom = atom<unknown>(undefined);
  let active = false;
  let lifetime = 0;
  let request = 0;
  let controller: AbortController | undefined;
  bunja.effect(() => {
    active = true;
    lifetime++;
    const unsubscribe = service.subscribe();
    return () => {
      active = false;
      lifetime++;
      request++;
      controller?.abort();
      unsubscribe();
    };
  });
  async function refresh() {
    if (!active) return;
    const generation = lifetime;
    const version = ++request;
    controller?.abort();
    controller = new AbortController();
    const current = () =>
      active && generation === lifetime && version === request;
    try {
      const result = await service.load(controller.signal);
      if (current()) {
        stateStore.set(titleAtom, result);
        stateStore.set(errorAtom, undefined);
      }
    } catch (cause) {
      if (current()) stateStore.set(errorAtom, () => cause);
    }
  }
  return { screen, stateStore, titleAtom, errorAtom, refresh };
});

export const ModeScope = createScope<"a" | "b">();
export const serviceA = bunja(() => "a");
export const serviceB = bunja(() => "b");
export const selected = bunja(() => {
  const mode = bunja.use(ModeScope);
  const a = bunja.will(serviceA);
  const b = bunja.will(serviceB);
  return mode === "a" ? a() : b();
});
