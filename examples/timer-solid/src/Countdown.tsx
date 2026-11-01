import { useBunja } from "bunja/solid";
import { countdownBunja } from "./state/countdown.ts";
import { ItemScope } from "./state/item.ts";
import { TitleEditor } from "./TitleEditor.tsx";
import { createSignal, Show } from "solid-js";

interface Props {
  id: number;
  onRemove(): void;
}

export function Countdown(props: Props) {
  const countdown = useBunja(countdownBunja, () => [ItemScope.bind(props.id)]);
  const [inputMinutes, setInputMinutes] = createSignal(0);
  const [inputSeconds, setInputSeconds] = createSignal(30);

  const handleStart = () => {
    countdown().startWithDuration(inputMinutes(), inputSeconds());
  };

  const handleReset = () => {
    countdown().resetWithDuration(inputMinutes(), inputSeconds());
  };

  return (
    <div class="timer-item">
      <TitleEditor
        title={countdown().title()}
        setTitle={countdown().setTitle}
        editingTitle={countdown().editingTitle()}
        setEditingTitle={countdown().setEditingTitle}
        icon="⏰"
      />

      <div
        class={`timer-status ${
          countdown().countdown.running
            ? "running"
            : countdown().countdown.finished
            ? "finished"
            : "stopped"
        }`}
      />

      <div class="timer-display">
        <div
          class={`timer-time ${
            countdown().countdown.running ? "running" : ""
          } ${countdown().countdown.finished ? "finished" : ""}`}
        >
          {countdown().minutes()}:{countdown().seconds()}
        </div>
        <Show when={countdown().countdown.finished}>
          <div class="timer-finished">Time's up!</div>
        </Show>
      </div>

      <div class="timer-controls">
        <Show
          when={!countdown().countdown.running &&
            !countdown().countdown.finished}
        >
          <div class="duration-input">
            <input
              type="number"
              min="0"
              max="59"
              value={inputMinutes()}
              onChange={(e) => setInputMinutes(Number(e.target.value))}
              class="duration-input-field"
            />
            <span>min</span>
            <input
              type="number"
              min="0"
              max="59"
              value={inputSeconds()}
              onChange={(e) => setInputSeconds(Number(e.target.value))}
              class="duration-input-field"
            />
            <span>sec</span>
          </div>
        </Show>

        <Show
          when={countdown().countdown.running}
          fallback={
            <button
              type="button"
              class="timer-btn success"
              onClick={handleStart}
              disabled={countdown().countdown.finished}
            >
              Start
            </button>
          }
        >
          <button
            type="button"
            class="timer-btn danger"
            onClick={countdown().stop}
          >
            Stop
          </button>
        </Show>

        <button
          type="button"
          class="timer-btn secondary"
          onClick={handleReset}
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
