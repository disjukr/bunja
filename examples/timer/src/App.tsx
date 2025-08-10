import { useAtomValue } from "jotai";
import { useBunja } from "bunja/react";
import { Timer } from "./Timer.tsx";
import { Countdown } from "./Countdown.tsx";
import { appBunja, type Item } from "./state/app.ts";

export function App() {
  const { itemsAtom, addTimer, addCountdown, remove } = useBunja(
    appBunja,
  );
  const items = useAtomValue(itemsAtom);

  const renderItem = (item: Item) => {
    const commonProps = {
      key: item.id,
      id: item.id,
      onRemove: () => remove(item.id),
    };

    return item.type === "timer"
      ? <Timer {...commonProps} />
      : <Countdown {...commonProps} />;
  };

  return (
    <div className="timer-app">
      <header className="timer-header">
        <h1>Bunja Timers</h1>
      </header>

      <section className="add-timer-section">
        <button
          type="button"
          className="add-timer-btn"
          onClick={addTimer}
        >
          Add new timer
        </button>
        <button
          type="button"
          className="add-timer-btn"
          onClick={addCountdown}
        >
          Add new countdown
        </button>
      </section>

      <section className="timer-list">
        {items.length === 0
          ? (
            <div className="empty-state">
              <h3>No timers or countdowns yet</h3>
              <p>Add a timer or countdown to get started!</p>
            </div>
          )
          : (
            items.map(renderItem)
          )}
      </section>

      {items.length > 0 && (
        <footer className="timer-footer">
          {items.length} item{items.length !== 1 ? "s" : ""} total
        </footer>
      )}
    </div>
  );
}
