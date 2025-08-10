import { bunja } from "bunja";
import { atom } from "jotai";
import { tickBunja } from "./tick.ts";
import { soundBunja } from "./sound.ts";
import { itemBunja, ItemScope } from "./item.ts";
import { JotaiStoreScope } from "./jotai-store.ts";

export interface TimerSnapshot {
  elapsed: number;
  running: boolean;
}

/**
 * Scoped timer state. Each scope value yields an independent timer.
 */
export const timerBunja = bunja(() => {
  bunja.use(ItemScope); // mark scope dependency
  const store = bunja.use(JotaiStoreScope); // get jotai store
  const { subscribe: onTick } = bunja.use(tickBunja);
  const { beep, boop } = bunja.use(soundBunja);
  const { titleAtom, editingTitleAtom } = bunja.use(itemBunja); // get title state

  // Create jotai atom for reactive state
  const timerAtom = atom<TimerSnapshot>({ elapsed: 0, running: false });

  // Derived atoms for formatted time display
  const secondsAtom = atom((get) => {
    const { elapsed } = get(timerAtom);
    return Math.floor(elapsed / 1000).toString().padStart(2, "0");
  });

  const millisecondsAtom = atom((get) => {
    const { elapsed } = get(timerAtom);
    return Math.floor((elapsed % 1000) / 10).toString().padStart(2, "0");
  });

  let unsubTick: (() => void) | null = null;

  function start() {
    const current = store.get(timerAtom);
    if (current.running) return;

    const startTime = Date.now() - current.elapsed;
    store.set(timerAtom, { ...current, running: true });

    unsubTick = onTick(() => {
      const elapsed = Date.now() - startTime;
      store.set(timerAtom, { elapsed, running: true });
    });
    beep();
  }

  function stop() {
    const current = store.get(timerAtom);
    if (!current.running) return;

    store.set(timerAtom, { ...current, running: false });
    unsubTick?.();
    unsubTick = null;
    boop();
  }

  function reset() {
    const current = store.get(timerAtom);
    store.set(timerAtom, { elapsed: 0, running: current.running });
  }

  bunja.effect(() => () => unsubTick?.());

  return {
    timerAtom,
    secondsAtom,
    millisecondsAtom,
    start,
    stop,
    reset,
    titleAtom,
    editingTitleAtom,
  };
});
