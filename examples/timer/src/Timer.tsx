import { useAtomValue } from "jotai";
import { useBunja } from "bunja/react";
import { timerBunja } from "./state/timer.ts";
import { ItemScope } from "./state/item.ts";
import { TitleEditor } from "./TitleEditor.tsx";

interface Props {
  id: number;
  onRemove(): void;
}

export function Timer({ id, onRemove }: Props) {
  const {
    timerAtom,
    secondsAtom,
    millisecondsAtom,
    start,
    stop,
    reset,
    titleAtom,
    editingTitleAtom,
  } = useBunja(timerBunja, [ItemScope.bind(id)]);
  const { running } = useAtomValue(timerAtom);
  const seconds = useAtomValue(secondsAtom);
  const ms = useAtomValue(millisecondsAtom);

  return (
    <div className="timer-item">
      <TitleEditor
        titleAtom={titleAtom}
        editingTitleAtom={editingTitleAtom}
        icon="⏱️"
      />

      <div className={`timer-status ${running ? "running" : "stopped"}`} />

      <div className="timer-display">
        <div className={`timer-time ${running ? "running" : ""}`}>
          {seconds}:{ms}
        </div>
      </div>

      <div className="timer-controls">
        {running
          ? (
            <button
              type="button"
              className="timer-btn danger"
              onClick={stop}
            >
              Stop
            </button>
          )
          : (
            <button
              type="button"
              className="timer-btn success"
              onClick={start}
            >
              Start
            </button>
          )}

        <button
          type="button"
          className="timer-btn secondary"
          onClick={reset}
        >
          Reset
        </button>

        <button
          type="button"
          className="timer-btn primary"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
