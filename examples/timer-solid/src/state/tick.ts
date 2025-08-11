import { bunja } from "bunja";

/**
 * Global ticker that emits once every 30ms.
 * The interval runs only while at least one timer is mounted.
 */
export const tickBunja = bunja(() => {
  const listeners = new Set<() => void>();

  function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  bunja.effect(() => {
    const id = setInterval(() => {
      listeners.forEach((l) => l());
    }, 30);
    return () => clearInterval(id);
  });

  return { subscribe };
});
