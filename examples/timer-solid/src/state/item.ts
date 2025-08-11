import { bunja, createScope } from "bunja";
import { createSignal } from "solid-js";

/**
 * Shared scope for timer and countdown items.
 * Each scope value yields an independent timer or countdown.
 */
export const ItemScope = createScope<number>();

/**
 * Common item state for title management
 */
export const itemBunja = bunja(() => {
  bunja.use(ItemScope); // mark scope dependency

  // Create solid signal for title
  const [title, setTitle] = createSignal("");

  // Create solid signal for editing state
  const [editingTitle, setEditingTitle] = createSignal(false);

  return { title, setTitle, editingTitle, setEditingTitle };
});
