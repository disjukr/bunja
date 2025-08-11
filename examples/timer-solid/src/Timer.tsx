import { timerBunja } from "./state/timer.ts";
import { ItemScope } from "./state/item.ts";
import { TitleEditor } from "./TitleEditor.tsx";
import { useBunja } from "bunja/solid";
import { createEffect, Show } from "solid-js";

interface Props {
  id: number;
  onRemove(): void;
}

export function Timer(props: Props) {
  const timer = useBunja(timerBunja, () => [ItemScope.bind(props.id)]);

  createEffect(() => {
    console.log(timer().title());
  });

  return (
    <div class="timer-item">
      <TitleEditor
        title={timer().title()}
        setTitle={timer().setTitle}
        editingTitle={timer().editingTitle()}
        setEditingTitle={timer().setEditingTitle}
        icon="⏱️"
      />

      <div
        class={`timer-status ${timer().timer.running ? "running" : "stopped"}`}
      />

      <div class="timer-display">
        <div class={`timer-time ${timer().timer.running ? "running" : ""}`}>
          {timer().seconds()}:{timer().milliseconds()}
        </div>
      </div>

      <div class="timer-controls">
        <Show
          when={timer().timer.running}
          fallback={
            <button
              type="button"
              class="timer-btn success"
              onClick={timer().start}
            >
              Start
            </button>
          }
        >
          <button
            type="button"
            class="timer-btn danger"
            onClick={timer().stop}
          >
            Stop
          </button>
        </Show>

        <button
          type="button"
          class="timer-btn secondary"
          onClick={timer().reset}
        >
          Reset
        </button>

        <button
          type="button"
          class="timer-btn primary"
          onClick={props.onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
