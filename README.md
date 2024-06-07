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
you only need to create a function that establishes the WebSocket connection and an dispose handler that terminates the connection.\
The library automatically tracks the actual usage period and calls the init and dispose as needed.

## So, do I no longer need jotai or other state management libraries?

No. Bunja focuses solely on managing the lifetime of state, so jotai and other state management libraries are still valuable.\
You can typically use jotai or something, and when lifetime management becomes necessary, you can wrap those states with bunja.

## How to use

Bunja provides two functions: `bunja` and `useBunja`.\
You can use `bunja` to define a state with a finite lifetime and use the `useBunja` hook to access that state.

### Defining a Bunja

You can define a bunja using the `bunja` function. When you access the defined bunja with the `useBunja` hook, a bunja instance is created.\
If all components in the render tree that refer to the bunja disappear, the bunja instance is automatically destroyed.

If you want to clean up resources when the bunja's lifetime ends, you can use the `Symbol.dispose` field.

```ts
const countBunja = bunja([], () => {
  const countAtom = atom(0);
  return {
    countAtom,
    [Symbol.dispose]() {
      console.log("disposed");
    },
  };
});

function MyComponent() {
  const { countAtom } = useBunja(countBunja);
  const [count, setCount] = useAtom(countAtom);
  // Your component logic here
}
```

This code snippet defines a bunja that creates a `countAtom`.\
The `Symbol.dispose` method is used when the bunja instance is no longer referenced by any component in the render tree, allowing you to clean up resources appropriately.

TODO: context
