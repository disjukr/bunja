import { test } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { createBunjaStore, override } from "bunja";
import { createRoot, flush } from "solid-js";
import { appBunja } from "./src/state/app.ts";
import { timerBunja } from "./src/state/timer.ts";
import { countdownBunja } from "./src/state/countdown.ts";
import { ItemScope } from "./src/state/item.ts";
import { tickBunja } from "./src/state/tick.ts";
import { soundBunja } from "./src/state/sound.ts";

test("Solid 2 timer models preserve scope, duration, reactive writes and cleanup", (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const listeners = new Set<() => void>();
  const sounds: string[] = [];
  const store = createBunjaStore({
    wrapInstance: createRoot,
    overrides: [
      override(tickBunja, () => ({ subscribe(fn) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
      } })),
      override(soundBunja, () => ({
        beep: () => { sounds.push("beep"); },
        boop: () => { sounds.push("boop"); },
        alarm: () => { sounds.push("alarm"); },
        stopAlarm: () => { sounds.push("stopAlarm"); },
      })),
    ],
  });
  t.after(() => store.dispose());
  const first = store.get({ bunja: timerBunja, with: [ItemScope.bind(1)] }, () => { throw Error("Unexpected scope"); });
  const second = store.get({ bunja: timerBunja, with: [ItemScope.bind(2)] }, () => { throw Error("Unexpected scope"); });
  const countdown = store.get({ bunja: countdownBunja, with: [ItemScope.bind(3)] }, () => { throw Error("Unexpected scope"); });
  const releases = [first.mount(), second.mount(), countdown.mount()];
  first.value.start();
  flush();
  strictEqual(first.value.timer.running, true);
  strictEqual(second.value.timer.running, false);
  now += 1230;
  listeners.forEach(tick => tick());
  flush();
  strictEqual(first.value.seconds(), "01");
  strictEqual(first.value.milliseconds(), "23");
  first.value.stop();
  flush();
  strictEqual(listeners.size, 0);
  first.value.reset();
  flush();
  strictEqual(first.value.timer.elapsed, 0);

  // A setter followed by start must use the requested duration, not the
  // previous committed 30-second store snapshot.
  countdown.value.startWithDuration(0, 2);
  flush();
  strictEqual(countdown.value.countdown.remaining, 2000);
  now += 1000;
  listeners.forEach(tick => tick());
  flush();
  strictEqual(countdown.value.seconds(), "01");
  countdown.value.stop();
  flush();
  now += 5000;
  countdown.value.startWithDuration(0, 2);
  flush();
  now += 1000;
  listeners.forEach(tick => tick());
  flush();
  strictEqual(countdown.value.countdown.finished, true);
  strictEqual(sounds.at(-1), "alarm");
  countdown.value.resetWithDuration(0, 3);
  flush();
  strictEqual(countdown.value.countdown.finished, false);
  strictEqual(countdown.value.countdown.remaining, 3000);
  countdown.value.start();
  flush();
  strictEqual(listeners.size, 1);
  releases.forEach(release => release());
  strictEqual(listeners.size, 0);
});

test("Solid 2 list draft updates compose in one frame", () => {
  const store = createBunjaStore({ wrapInstance: createRoot });
  const entry = store.get(appBunja, () => { throw Error("Unexpected scope"); });
  const release = entry.mount();
  entry.value.addTimer();
  entry.value.addCountdown();
  flush();
  deepStrictEqual(entry.value.items.map(item => item.type), ["timer", "countdown"]);
  entry.value.remove(0);
  flush();
  deepStrictEqual(entry.value.items.map(item => item.id), [1]);
  release();
  store.dispose();
});
