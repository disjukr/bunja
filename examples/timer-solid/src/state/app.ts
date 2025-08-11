import { bunja } from "bunja";
import { createStore } from "solid-js/store";

export type ItemType = "timer" | "countdown";

export interface Item {
  id: number;
  type: ItemType;
}

/**
 * App state management for timer and countdown items.
 * Manages the list of active items and provides functions to add/remove them.
 */
export const appBunja = bunja(() => {
  const [items, setItems] = createStore<Item[]>([]);
  let counter = 0; // Simple counter for generating unique IDs

  /**
   * Add a new timer item
   */
  function addTimer() {
    const newItem: Item = { id: counter++, type: "timer" };
    setItems((current) => [...current, newItem]);
  }

  /**
   * Add a new countdown item
   */
  function addCountdown() {
    const newItem: Item = { id: counter++, type: "countdown" };
    setItems((current) => [...current, newItem]);
  }

  /**
   * Remove an item by its ID
   */
  function remove(id: number) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return { items, addTimer, addCountdown, remove };
});
