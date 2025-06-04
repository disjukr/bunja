import { type Bunja, bunja as bunjaV2, type Dep } from "../bunja.ts";

export const bunja: {
  <T>(deps: [], init: () => T & BunjaValue): Bunja<T>;
  <T, U>(deps: [Dep<U>], init: (u: U) => T & BunjaValue): Bunja<T>;
  <T, U, V>(
    deps: [Dep<U>, Dep<V>],
    init: (u: U, v: V) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W>(
    deps: [Dep<U>, Dep<V>, Dep<W>],
    init: (u: U, v: V, w: W) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W, X>(
    deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>],
    init: (u: U, v: V, w: W, x: X) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W, X, Y>(
    deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>, Dep<Y>],
    init: (u: U, v: V, w: W, x: X, y: Y) => T & BunjaValue,
  ): Bunja<T>;
  <T, U, V, W, X, Y, Z>(
    deps: [Dep<U>, Dep<V>, Dep<W>, Dep<X>, Dep<Y>, Dep<Z>],
    init: (u: U, v: V, w: W, x: X, y: Y, z: Z) => T & BunjaValue,
  ): Bunja<T>;
  readonly effect: BunjaEffectSymbol;
} = bunjaImpl;

const bunjaEffectSymbol: unique symbol = Symbol("Bunja.effect");
type BunjaEffectSymbol = typeof bunjaEffectSymbol;
function bunjaImpl<T, const U extends unknown[]>(
  deps: { [K in keyof U]: Dep<U[K]> },
  init: (...args: U) => T & BunjaValue,
): Bunja<T> {
  return bunjaV2(() => {
    const value = init(...deps.map(bunjaV2.use) as U);
    const effect = value[bunjaImpl.effect];
    if (effect) bunjaV2.effect(effect);
    return value;
  });
}
bunjaImpl.effect = bunjaEffectSymbol;

export type BunjaEffectFn = () => () => void;
export interface BunjaValue {
  [bunjaImpl.effect]?: BunjaEffectFn;
}
