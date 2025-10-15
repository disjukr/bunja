import type { Bunja, ScopeValuePair } from "@disjukr/bunja";
import type { Context, PropsWithChildren } from "react";

import type { Fiber } from "./fiber/provider.tsx";
import { ContextProvider } from "./fiber/tag.ts";

export type ContextValuePair = [Context<unknown>, unknown];
export type BrtNode = BrtComponent | BrtContext;
export interface BunjaHookValue {
  bunja: Bunja<unknown>;
  scopeValuePairs: ScopeValuePair<unknown>[];
  bunjaInstance: unknown;
}
interface BrtBase {
  no: number;
  key: string | null;
  name: string;
}
export interface BrtComponent extends BrtBase {
  type: "component";
  bunjaHooks: BunjaHookValue[];
  children: BrtNode[];
}
export interface BrtContext extends BrtBase {
  type: "context";
  children: BrtNode[];
  contexts: ContextValuePair[];
}

export function BrtIgnore({ children }: PropsWithChildren) {
  return children;
}

export function toBunjaRenderTree(fiber: Fiber): BrtNode[] {
  const result = traverse(fiber);
  writeNo(result);
  return result;
  function traverse(fiber: Fiber): BrtNode[] {
    if (fiber.type === BrtIgnore) return [];
    const key = fiber.key;
    const name = getFiberName(fiber);
    if (fiber.tag === ContextProvider) {
      const { contexts, next } = collapseContexts(fiber);
      const children = traverseChildren(next);
      if (children.length === 0) return [];
      return [{ type: "context", no: 0, key, name, contexts, children }];
    }
    const children = traverseChildren(fiber.child);
    const isUsingBunja = checkUsingBunja(fiber);
    if (!isUsingBunja) return children;
    const bunjaHooks = collectBunjaHooks(fiber);
    return [{ type: "component", no: 0, key, name, bunjaHooks, children }];
  }
  function traverseChildren(child?: Fiber | null): BrtNode[] {
    const result: BrtNode[] = [];
    let curr: Fiber | undefined | null = child;
    while (curr) {
      result.push(...traverse(curr));
      curr = curr.sibling;
    }
    return result;
  }
  interface CollapseContextsResult {
    contexts: ContextValuePair[];
    next: Fiber | null;
  }
  function collapseContexts(contextFiber: Fiber): CollapseContextsResult {
    const contexts: ContextValuePair[] = [];
    let curr: Fiber | null = contextFiber;
    while (curr) {
      if (curr.tag === ContextProvider) {
        const context = curr.type as Context<unknown>;
        const value = curr.memoizedProps.value;
        contexts.push([context, value]);
      } else if (checkUsingBunja(curr)) break;
      curr = curr.child;
      if (curr?.sibling) break;
    }
    return { contexts, next: curr };
  }
  function writeNo(nodes: BrtNode[], start: number = 1): number {
    let curr = start;
    for (const node of nodes) {
      node.no = curr++;
      curr = writeNo(node.children, curr);
    }
    return curr;
  }
}

export function brtToString(nodes: BrtNode[], depth = 0): string {
  const indent = " ".repeat(depth * 2);
  let result = "";
  for (const node of nodes) {
    if (node.type === "component") {
      const { name, bunjaHooks, children } = node;
      const count = bunjaHooks.length;
      result += `${indent}<${name || "[Anonymous]"} useBunja=${count}>\n`;
      result += brtToString(children, depth + 1);
    } else if (node.type === "context") {
      const { contexts, children } = node;
      const count = contexts.length;
      if (count === 1) {
        const [context, value] = contexts[0];
        const name = context.displayName || "[Anonymous Context]";
        result += `${indent}<${name} value=${repr(value)}>\n`;
      } else {
        result += `${indent}<Contexts count=${count}>\n`;
      }
      result += brtToString(children, depth + 1);
    }
  }
  return result;
}

function repr(value: unknown): string {
  if (!value) return String(value);
  if (typeof value === "function") return value.name || "[Function]";
  if (typeof value === "object") {
    return `[${Object.prototype.toString.call(value).slice(8, -1)}]`;
  }
  if (typeof value !== "string") return String(value);
  const json = JSON.stringify(value);
  return json.length > 20 ? json.slice(0, 20) + '..."' : json;
}

function getFiberName({ type }: Fiber): string {
  if (!type) return "";
  if (typeof type === "string") return type;
  return type._context?.displayName || type.displayName || type.name || "";
}

function checkUsingBunja(fiber: Fiber): boolean {
  if (!fiber.memoizedState) return false;
  let curr = fiber.memoizedState;
  while (curr) {
    if (checkBunjaMemo(curr.memoizedState)) return true;
    curr = curr.next;
  }
  return false;
}

function collectBunjaHooks(fiber: Fiber): BunjaHookValue[] {
  const bunjaHooks: BunjaHookValue[] = [];
  if (!fiber.memoizedState) return bunjaHooks;
  let curr = fiber.memoizedState;
  while (curr) {
    const hook = curr.memoizedState;
    if (checkBunjaMemo(hook)) bunjaHooks.push(hook[0]);
    curr = curr.next;
  }
  return bunjaHooks;
}

type BunjaMemo = [BunjaHookValue, unknown[]];
function checkBunjaMemo(memoizedState: unknown): memoizedState is BunjaMemo {
  if (!Array.isArray(memoizedState)) return false;
  if (memoizedState.length !== 2) return false;
  return checkBunjaHookValue(memoizedState[0]);
}

function checkBunjaHookValue(memo: unknown): memo is BunjaHookValue {
  if (typeof memo !== "object" || memo == null) return false;
  if (!("bunja" in memo)) return false;
  if (!("scopeValuePairs" in memo)) return false;
  if (!("bunjaInstance" in memo)) return false;
  return true;
}
