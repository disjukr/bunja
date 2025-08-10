import { useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";

interface Props {
  titleAtom: PrimitiveAtom<string>;
  editingTitleAtom: PrimitiveAtom<boolean>;
  icon: string;
}

export function TitleEditor({ titleAtom, editingTitleAtom, icon }: Props) {
  const [title, setTitle] = useAtom(titleAtom);
  const [isEditingTitle, setIsEditingTitle] = useAtom(editingTitleAtom);

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      setIsEditingTitle(false);
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
  };

  return (
    <div className="timer-title-section">
      <div className="timer-title-with-icon">
        <span className="timer-type-icon">{icon}</span>
        {isEditingTitle
          ? (
            <input
              type="text"
              className="timer-title timer-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          )
          : (
            <div
              className="timer-title timer-title-display"
              onClick={handleTitleClick}
            >
              {title || "Click to add title..."}
            </div>
          )}
      </div>
    </div>
  );
}
