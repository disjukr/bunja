import { useState } from "react";
import { useAtomValue } from "jotai";
import { useBunja } from "bunja/react";
import { countdownBunja } from "./state/countdown.ts";
import { ItemScope } from "./state/item.ts";
import { TitleEditor } from "./TitleEditor.tsx";

interface Props {
  id: number;
  onRemove(): void;
}

export function Countdown({ id, onRemove }: Props) {
  const {
    countdownAtom,
    minutesAtom,
    secondsAtom,
    stop,
    startWithDuration,
    resetWithDuration,
    titleAtom,
    editingTitleAtom,
  } = useBunja(countdownBunja, [ItemScope.bind(id)]);
  const { running, finished } = useAtomValue(countdownAtom);
  const minutes = useAtomValue(minutesAtom);
  const seconds = useAtomValue(secondsAtom);
  const [inputMinutes, setInputMinutes] = useState(0);
  const [inputSeconds, setInputSeconds] = useState(30);

  const handleStart = () => {
    startWithDuration(inputMinutes, inputSeconds);
  };

  const handleReset = () => {
    resetWithDuration(inputMinutes, inputSeconds);
  };

  return (
    <div className="timer-item">
      <TitleEditor
        titleAtom={titleAtom}
        editingTitleAtom={editingTitleAtom}
        icon="⏰"
      />

      <div
        className={`timer-status ${
          running ? "running" : finished ? "finished" : "stopped"
        }`}
      />

      <div className="timer-display">
        <div
          className={`timer-time ${running ? "running" : ""} ${
            finished ? "finished" : ""
          }`}
        >
          {minutes}:{seconds}
        </div>
        {finished && <div className="timer-finished">Time's up!</div>}
      </div>

      <div className="timer-controls">
        {!running && !finished && (
          <div className="duration-input">
            <input
              type="number"
              min="0"
              max="59"
              value={inputMinutes}
              onChange={(e) => setInputMinutes(Number(e.target.value))}
              className="duration-input-field"
            />
            <span>min</span>
            <input
              type="number"
              min="0"
              max="59"
              value={inputSeconds}
              onChange={(e) => setInputSeconds(Number(e.target.value))}
              className="duration-input-field"
            />
            <span>sec</span>
          </div>
        )}

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
              onClick={handleStart}
              disabled={finished}
            >
              Start
            </button>
          )}

        <button
          type="button"
          className="timer-btn secondary"
          onClick={handleReset}
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
