import { bunja } from "bunja";
import { atom } from "jotai";
import { tickBunja } from "./tick.ts";
import { soundBunja } from "./sound.ts";
import { itemBunja, ItemScope } from "./item.ts";
import { JotaiStoreScope } from "./jotai-store.ts";

export interface CountdownSnapshot {
  remaining: number;
  running: boolean;
  finished: boolean;
}

/**
 * Scoped countdown state. Each scope value yields an independent countdown.
 */
export const countdownBunja = bunja(() => {
  bunja.use(ItemScope); // mark scope dependency
  const store = bunja.use(JotaiStoreScope); // get jotai store
  const { subscribe: onTick } = bunja.use(tickBunja);
  const { beep, boop, alarm, stopAlarm } = bunja.use(soundBunja);
  const { titleAtom, editingTitleAtom } = bunja.use(itemBunja); // get title state

  // Create jotai atom for reactive state
  const countdownAtom = atom<CountdownSnapshot>({
    remaining: 30000,
    running: false,
    finished: false,
  });

  // Derived atoms for minutes and seconds display
  const minutesAtom = atom((get) => {
    const { remaining } = get(countdownAtom);
    // Use Math.ceil to show the current second until it's fully elapsed
    const totalSeconds = Math.ceil(remaining / 1000);
    return Math.floor(totalSeconds / 60);
  });

  const secondsAtom = atom((get) => {
    const { remaining } = get(countdownAtom);
    // Use Math.ceil to show the current second until it's fully elapsed
    const totalSeconds = Math.ceil(remaining / 1000);
    return (totalSeconds % 60).toString().padStart(2, "0");
  });

  // Store initial time separately for reset functionality
  let initialTime = 30000;

  let unsubTick: (() => void) | null = null;

  function start() {
    const current = store.get(countdownAtom);
    if (current.running || current.finished) return;

    const startTime = Date.now();
    const targetTime = startTime + current.remaining;

    store.set(countdownAtom, { ...current, running: true });

    unsubTick = onTick(() => {
      const now = Date.now();
      const remaining = Math.max(0, targetTime - now);

      if (remaining === 0) {
        store.set(countdownAtom, {
          ...store.get(countdownAtom),
          remaining: 0,
          running: false,
          finished: true,
        });
        unsubTick?.();
        unsubTick = null;
        alarm(); // alarm sound when countdown finished
      } else {
        store.set(countdownAtom, {
          ...store.get(countdownAtom),
          remaining,
        });
      }
    });
    beep();
  }

  function stop() {
    const current = store.get(countdownAtom);
    if (!current.running) return;

    store.set(countdownAtom, { ...current, running: false });
    unsubTick?.();
    unsubTick = null;
    boop();
  }

  function reset() {
    const current = store.get(countdownAtom);
    if (current.finished) stopAlarm();

    store.set(countdownAtom, {
      ...current,
      remaining: initialTime,
      running: false,
      finished: false,
    });
    unsubTick?.();
    unsubTick = null;
  }

  function setDuration(newDuration: number) {
    const current = store.get(countdownAtom);
    if (current.running) return;

    initialTime = newDuration;
    store.set(countdownAtom, {
      ...current,
      remaining: newDuration,
      finished: false,
    });
  }

  function startWithDuration(minutes: number, seconds: number) {
    const newDuration = (minutes * 60000) + (seconds * 1000);
    const current = store.get(countdownAtom);

    // Set new time if finished or starting for the first time (default 30s state)
    if (current.finished || current.remaining === 30000) {
      if (newDuration > 0) {
        setDuration(newDuration);
        start();
      }
    } else {
      // Resume from remaining time when restarting after stop
      start();
    }
  }

  function resetWithDuration(minutes: number, seconds: number) {
    const current = store.get(countdownAtom);
    if (current.finished) stopAlarm();

    const newDuration = (minutes * 60000) + (seconds * 1000);
    if (newDuration > 0) {
      setDuration(newDuration);
    } else {
      reset();
    }
  }

  bunja.effect(() => () => unsubTick?.());

  return {
    countdownAtom,
    minutesAtom,
    secondsAtom,
    titleAtom,
    editingTitleAtom,
    start,
    stop,
    reset,
    setDuration,
    startWithDuration,
    resetWithDuration,
  };
});
