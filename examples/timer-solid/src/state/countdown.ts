import { bunja } from "bunja";
import { tickBunja } from "./tick.ts";
import { soundBunja } from "./sound.ts";
import { itemBunja, ItemScope } from "./item.ts";
import { createStore } from "solid-js/store";
import { createMemo } from "solid-js";

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
  const { subscribe: onTick } = bunja.use(tickBunja);
  const { beep, boop, alarm, stopAlarm } = bunja.use(soundBunja);
  const { title, setTitle, editingTitle, setEditingTitle } = bunja.use(
    itemBunja,
  ); // get title state

  // Create solid store for reactive state
  const [countdown, setCountdown] = createStore<CountdownSnapshot>({
    remaining: 30000,
    running: false,
    finished: false,
  });

  // Derived memos for minutes and seconds display
  const minutes = createMemo(() => {
    // Use Math.ceil to show the current second until it's fully elapsed
    const totalSeconds = Math.ceil(countdown.remaining / 1000);
    return Math.floor(totalSeconds / 60);
  });

  const seconds = createMemo(() => {
    // Use Math.ceil to show the current second until it's fully elapsed
    const totalSeconds = Math.ceil(countdown.remaining / 1000);
    return (totalSeconds % 60).toString().padStart(2, "0");
  });

  // Store initial time separately for reset functionality
  let initialTime = 30000;

  let unsubTick: (() => void) | null = null;

  function start() {
    if (countdown.running || countdown.finished) return;

    const startTime = Date.now();
    const targetTime = startTime + countdown.remaining;

    setCountdown("running", true);

    unsubTick = onTick(() => {
      const now = Date.now();
      const remaining = Math.max(0, targetTime - now);

      if (remaining === 0) {
        setCountdown({
          remaining: 0,
          running: false,
          finished: true,
        });
        unsubTick?.();
        unsubTick = null;
        alarm(); // alarm sound when countdown finished
      } else {
        setCountdown("remaining", remaining);
      }
    });
    beep();
  }

  function stop() {
    if (!countdown.running) return;

    setCountdown("running", false);
    unsubTick?.();
    unsubTick = null;
    boop();
  }

  function reset() {
    if (countdown.finished) stopAlarm();

    setCountdown({
      remaining: initialTime,
      running: false,
      finished: false,
    });
    unsubTick?.();
    unsubTick = null;
  }

  function setDuration(newDuration: number) {
    if (countdown.running) return;

    initialTime = newDuration;
    setCountdown({
      remaining: newDuration,
      finished: false,
    });
  }

  function startWithDuration(minutes: number, seconds: number) {
    const newDuration = (minutes * 60000) + (seconds * 1000);

    // Set new time if finished or starting for the first time (default 30s state)
    if (countdown.finished || countdown.remaining === 30000) {
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
    if (countdown.finished) stopAlarm();

    const newDuration = (minutes * 60000) + (seconds * 1000);
    if (newDuration > 0) {
      setDuration(newDuration);
    } else {
      reset();
    }
  }

  bunja.effect(() => () => unsubTick?.());

  return {
    countdown,
    minutes,
    seconds,
    title,
    setTitle,
    editingTitle,
    setEditingTitle,
    start,
    stop,
    reset,
    setDuration,
    startWithDuration,
    resetWithDuration,
  };
});
