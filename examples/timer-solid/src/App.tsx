import { useBunja } from "bunja/solid";
import { Timer } from "./Timer.tsx";
import { Countdown } from "./Countdown.tsx";
import { appBunja } from "./state/app.ts";
import { Dynamic } from "solid-js/web";
import { For, Show } from "solid-js";

export function App() {
  const app = useBunja(appBunja);

  return (
    <div class="timer-app">
      <header class="timer-header">
        <h1>Bunja Timers</h1>
      </header>

      <section class="add-timer-section">
        <button
          type="button"
          class="add-timer-btn"
          onClick={app().addTimer}
        >
          Add new timer
        </button>
        <button
          type="button"
          class="add-timer-btn"
          onClick={app().addCountdown}
        >
          Add new countdown
        </button>
      </section>

      <section class="timer-list">
        <For
          each={app().items}
          fallback={
            <div class="empty-state">
              <h3>No timers or countdowns yet</h3>
              <p>Add a timer or countdown to get started!</p>
            </div>
          }
        >
          {(item) => (
            <Dynamic
              component={item.type === "timer" ? Timer : Countdown}
              id={item.id}
              onRemove={() => app().remove(item.id)}
            />
          )}
        </For>
      </section>

      <Show when={app().items.length}>
        {(length) => (
          <footer class="timer-footer">
            {length()} item{length() !== 1 ? "s" : ""} total
          </footer>
        )}
      </Show>
    </div>
  );
}
