import { bunja } from "bunja";
import { tickBunja } from "./tick.ts";
import { soundBunja } from "./sound.ts";
import { itemBunja, ItemScope } from "./item.ts";
import { createStore } from "solid-js/store";
import { createMemo } from "solid-js";

export interface TimerSnapshot {
  elapsed: number;
  running: boolean;
}

/**
 * Scoped timer state. Each scope value yields an independent timer.
 */
export const timerBunja = bunja(() => {
  bunja.use(ItemScope); // mark scope dependency
  const { subscribe: onTick } = bunja.use(tickBunja);
  const { beep, boop } = bunja.use(soundBunja);
  const { title, setTitle, editingTitle, setEditingTitle } = bunja.use(
    itemBunja,
  ); // get title state

  // Create solid store for reactive state
  const [timer, setTimer] = createStore<TimerSnapshot>({
    elapsed: 0,
    running: false,
  });

  // Derived memos for formatted time display
  const seconds = createMemo(() => {
    return Math.floor(timer.elapsed / 1000).toString().padStart(2, "0");
  });

  const milliseconds = createMemo(() => {
    return Math.floor((timer.elapsed % 1000) / 10).toString().padStart(2, "0");
  });

  let unsubTick: (() => void) | null = null;

  function start() {
    if (timer.running) return;

    const startTime = Date.now() - timer.elapsed;
    setTimer("running", true);

    unsubTick = onTick(() => {
      const elapsed = Date.now() - startTime;
      setTimer({ elapsed, running: true });
    });
    beep();
  }

  function stop() {
    if (!timer.running) return;

    setTimer("running", false);
    unsubTick?.();
    unsubTick = null;
    boop();
  }

  function reset() {
    setTimer("elapsed", 0);
  }

  bunja.effect(() => () => unsubTick?.());

  return {
    timer,
    seconds,
    milliseconds,
    start,
    stop,
    reset,
    title,
    setTitle,
    editingTitle,
    setEditingTitle,
  };
});
