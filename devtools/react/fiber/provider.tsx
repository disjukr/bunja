"use client";

import React from "react";
import type ReactReconciler from "react-reconciler";
import { createScopeFromContext } from "bunja/react";

export type Fiber = ReactReconciler.Fiber;
export const FiberContext = React.createContext<Fiber>(null!);
export const FiberScope = createScopeFromContext(FiberContext);

export class FiberProvider extends React.Component<React.PropsWithChildren> {
  private _reactInternals!: Fiber;
  override render() {
    return (
      <FiberContext value={this._reactInternals}>
        {this.props.children}
      </FiberContext>
    );
  }
}
