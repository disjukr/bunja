# Bunja

Bunja is State Lifetime Manager for React. (Minified & gzipped size < 1kB)\
Heavily inspired by [Bunshi](https://github.com/saasquatch/bunshi).

> Definition: Bunja (分子 / 분자) - Korean for molecule, member or element.

## Why is managing the lifetime of state necessary?

Global state managers like jotai or signals offer the advantage of declaratively describing state and effectively reducing render counts,
but they lack suitable methods for managing resources with a defined start and end.\
For example, consider establishing and closing a WebSocket connection or a modal form UI that appears temporarily and then disappears.

Bunja is a library designed to address these weaknesses.\
Each state defined with Bunja has a lifetime that begins when it is first depended on somewhere in the render tree and ends when all dependencies disappear.

Therefore, when writing a state to manage a WebSocket,
you only need to create a mount handler that establishes the WebSocket connection and an unmount handler that terminates the connection.\
The library automatically tracks the actual usage period and calls the mount and unmount handlers as needed.

## So, do I no longer need jotai or other state management libraries?

No. Bunja focuses solely on managing the lifetime of state, so jotai and other state management libraries are still valuable.\
You can typically use jotai or something, and when lifetime management becomes necessary, you can wrap those states with bunja.

## How to use

Bunja provides two functions: `bunja` and `useBunja`.\
You can use `bunja` to define a state with a finite lifetime and use the `useBunja` hook to access that state.

**(TODO)**
