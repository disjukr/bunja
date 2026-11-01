import { bunja } from "bunja";
import { createStore } from "solid-js";

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
    setItems((items) => { items.push(newItem); });
  }

  /**
   * Add a new countdown item
   */
  function addCountdown() {
    const newItem: Item = { id: counter++, type: "countdown" };
    setItems((items) => { items.push(newItem); });
  }

  /**
   * Remove an item by its ID
   */
  function remove(id: number) {
    setItems((items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index !== -1) items.splice(index, 1);
    });
  }

  return { items, addTimer, addCountdown, remove };
});
