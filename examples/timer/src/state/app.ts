import { bunja } from "bunja";
import { atom } from "jotai";
import { JotaiStoreScope } from "./jotai-store.ts";

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
  const store = bunja.use(JotaiStoreScope);

  const itemsAtom = atom<Item[]>([]);
  let counter = 0; // Simple counter for generating unique IDs

  /**
   * Add a new timer item
   */
  function addTimer() {
    const current = store.get(itemsAtom);
    const newItem: Item = { id: counter++, type: "timer" };
    store.set(itemsAtom, [...current, newItem]);
  }

  /**
   * Add a new countdown item
   */
  function addCountdown() {
    const current = store.get(itemsAtom);
    const newItem: Item = { id: counter++, type: "countdown" };
    store.set(itemsAtom, [...current, newItem]);
  }

  /**
   * Remove an item by its ID
   */
  function remove(id: number) {
    const current = store.get(itemsAtom);
    store.set(itemsAtom, current.filter((item) => item.id !== id));
  }

  return { itemsAtom, addTimer, addCountdown, remove };
});
