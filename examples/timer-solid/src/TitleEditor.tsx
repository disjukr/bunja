import { Show } from "solid-js";

interface Props {
  title: string;
  setTitle: (title: string) => void;
  editingTitle: boolean;
  setEditingTitle: (editingTitle: boolean) => void;
  icon: string;
}

export function TitleEditor(props: Props) {
  const handleTitleClick = () => {
    props.setEditingTitle(true);
  };

  const handleTitleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      props.setEditingTitle(false);
    }
  };

  const handleTitleBlur = () => {
    props.setEditingTitle(false);
  };

  return (
    <div class="timer-title-section">
      <div class="timer-title-with-icon">
        <span class="timer-type-icon">{props.icon}</span>
        <Show
          when={props.editingTitle}
          fallback={
            <div
              class="timer-title timer-title-display"
              onClick={handleTitleClick}
            >
              {props.title || "Click to add title..."}
            </div>
          }
        >
          <input
            type="text"
            class="timer-title timer-title-input"
            value={props.title}
            onInput={(e) => props.setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autofocus
          />
        </Show>
      </div>
    </div>
  );
}
