# Bunja

Bunja is lightweight State Lifetime Manager.\
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

Bunja basically provides two functions: `bunja` and `useBunja`.\
You can use `bunja` to define a state with a finite lifetime and use the `useBunja` hook to access that state.

### Defining a Bunja

You can define a bunja using the `bunja` function. When you access the defined bunja with the `useBunja` hook, a bunja instance is created.\
If all components in the render tree that refer to the bunja disappear, the bunja instance is automatically destroyed.

If you want to trigger effects when the lifetime of a bunja starts and ends, you can use the `bunja.effect` field.

```ts
import { bunja } from "bunja";
import { useBunja } from "bunja/react";

const countBunja = bunja([], () => {
  const countAtom = atom(0);
  return {
    countAtom,
    [bunja.effect]() {
      console.log("mounted");
      return () => console.log("unmounted");
    },
  };
});

function MyComponent() {
  const { countAtom } = useBunja(countBunja);
  const [count, setCount] = useAtom(countAtom);
  // Your component logic here
}
```

### Defining a Bunja that relies on other Bunja

If you want to manage a state with a broad lifetime and another state with a narrower lifetime, you can create a (narrower) bunja that depends on a (broader) bunja.
For example, you can think of a bunja that manages the WebSocket connection and disconnection, and another bunja that subscribes to a specific resource over the connected WebSocket.

In an application composed of multiple pages, you might want to subscribe to the Foo resource on page A and the Bar resource on page B, while using the same WebSocket connection regardless of which page you're on.
In such a case, you can write the following code.

```ts
// To simplify the example, code for buffering and reconnection has been omitted.
const websocketBunja = bunja([], () => {
  let socket;
  const send = (message) => socket.send(JSON.stringify(message));

  const emitter = new EventEmitter();
  const on = (handler) => {
    emitter.on("message", handler);
    return () => emitter.off("message", handler);
  };

  return {
    send,
    on,
    [bunja.effect]() {
      socket = new WebSocket("...");
      socket.onmessage = (e) => emitter.emit("message", JSON.parse(e.data));
      return () => socket.close();
    },
  };
});

const resourceFooBunja = bunja([websocketBunja], ({ send, on }) => {
  const resourceFooAtom = atom();
  return {
    resourceFooAtom,
    [bunja.effect]() {
      const off = on((message) => {
        if (message.type === "foo") store.set(resourceAtom, message.value);
      });
      send("subscribe-foo");
      return () => {
        send("unsubscribe-foo");
        off();
      };
    },
  };
});

const resourceBarBunja = bunja([websocketBunja], ({ send, on }) => {
  const resourceBarAtom = atom();
  // ...
});

function PageA() {
  const { resourceFooAtom } = useBunja(resourceFooBunja);
  const resourceFoo = useAtomValue(resourceFooAtom);
  // ...
}

function PageB() {
  const { resourceBarAtom } = useBunja(resourceBarBunja);
  const resourceBar = useAtomValue(resourceBarAtom);
  // ...
}
```

Notice that `websocketBunja` is not directly `useBunja`-ed.
When you `useBunja` either `resourceFooBunja` or `resourceBarBunja`, since they depend on `websocketBunja`,
it has the same effect as if `websocketBunja` were also `useBunja`-ed.

> [!NOTE]
> When a bunja starts, the initialization effect of the bunja with a broader lifetime is called first.\
> Similarly, when a bunja ends, the cleanup effect of the bunja with the broader lifetime is called first.\
> This behavior is aligned with how React's `useEffect` cleanup function is invoked, where the parent’s cleanup is executed before the child’s in the render tree.
>
> See: <https://github.com/facebook/react/issues/16728>

### Dependency injection using Scope

You can use a bunja for local state management.\
When you specify a scope as a dependency of the bunja, separate bunja instances are created based on the values injected into the scope.

```ts
import { bunja, createScope } from "bunja";

const UrlScope = createScope();

const fetchBunja = bunja([UrlScope], (url) => {
  const queryAtom = atomWithQuery((get) => ({
    queryKey: [url],
    queryFn: async () => (await fetch(url)).json(),
  }));
  return { queryAtom };
});
```

#### Injecting dependencies via React context

If you bind a scope to a React context, bunjas that depend on the scope can retrieve values from the corresponding React context.

In the example below, there are two React instances (`<ChildComponent />`) that reference the same `fetchBunja`, but since each looks at a different context value, two separate bunja instances are also created.

```tsx
import { createContext } from "react";
import { bunja, createScope } from "bunja";
import { bindScope } from "bunja/react";

const UrlContext = createContext("https://example.com/");
const UrlScope = createScope();
bindScope(UrlScope, UrlContext);

const fetchBunja = bunja([UrlScope], (url) => {
  const queryAtom = atomWithQuery((get) => ({
    queryKey: [url],
    queryFn: async () => (await fetch(url)).json(),
  }));
  return { queryAtom };
});

function ParentComponent() {
  return (
    <>
      <UrlContext.Provider value="https://example.com/foo">
        <ChildComponent />
      </UrlContext.Provider>
      <UrlContext.Provider value="https://example.com/bar">
        <ChildComponent />
      </UrlContext.Provider>
    </>
  );
}

function ChildComponent() {
  const { queryAtom } = useBunja(fetchBunja);
  const { data, isPending, isError } = useAtomValue(queryAtom);
  // Your component logic here
}
```

You can use the `createScopeFromContext` function to handle both the creation of the scope and the binding to the context in one step.

```ts
import { createContext } from "react";
import { createScopeFromContext } from "bunja/react";

const UrlContext = createContext("https://example.com/");
const UrlScope = createScopeFromContext(UrlContext);
```

#### Injecting dependencies directly into the scope

You might want to use a bunja directly within a React component where the values to be injected into the scope are created.

In such cases, you can use the inject function to inject values into the scope without wrapping the context separately.

```tsx
import { inject } from "bunja/react";

function MyComponent() {
  const { queryAtom } = useBunja(
    fetchBunja,
    inject([[UrlScope, "https://example.com/"]])
  );
  const { data, isPending, isError } = useAtomValue(queryAtom);
  // Your component logic here
}
```
