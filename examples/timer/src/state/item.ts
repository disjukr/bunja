import { bunja, createScope } from "bunja";
import { atom } from "jotai";

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

  // Create jotai atom for title
  const titleAtom = atom<string>("");

  // Create jotai atom for editing state
  const editingTitleAtom = atom<boolean>(false);

  return { titleAtom, editingTitleAtom };
});
