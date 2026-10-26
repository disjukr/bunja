import { bunja, createScope } from "bunja";

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
  let filter = storage.getItem(key) ?? "";
  return {
    read: () => filter,
    set(value: string) {
      // Preserve storage errors rather than pretending persistence succeeded.
      storage.setItem(key, value);
      filter = value;
    },
  };
});

export const model = bunja.withSeed({ title: "" }, (seed) => {
  const screen = bunja.use(ScreenScope);
  const service = bunja.use(ServiceScope);
  let title = seed.title;
  let error: unknown;
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
        title = result;
        error = undefined;
      }
    } catch (cause) {
      if (current()) error = cause;
    }
  }
  return { screen, refresh, snapshot: () => ({ title, error }) };
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
