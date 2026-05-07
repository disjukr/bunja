# Bunja

Bunja is lightweight State Lifetime Manager.\
Heavily inspired by [Bunshi](https://github.com/saasquatch/bunshi).

> Definition: Bunja (分子 / 분자) - Korean for molecule, member or element.

## Why is managing the lifetime of state necessary?

Global state managers like jotai or signals offer the advantage of declaratively
describing state and effectively reducing render counts, but they lack suitable
methods for managing resources with a defined start and end.\
For example, consider establishing and closing a WebSocket connection or a modal
form UI that appears temporarily and then disappears.

Bunja is a library designed to address these weaknesses.\
Each state defined with Bunja has a lifetime that begins when it is first
depended on somewhere in the render tree and ends when all dependencies
disappear.

Therefore, when writing a state to manage a WebSocket, you only need to create a
function that establishes the WebSocket connection and a disposal handler that
terminates the connection.\
The library automatically tracks the actual usage period and calls the init and
dispose as needed.

## So, do I no longer need jotai or other state management libraries?

No. Bunja focuses solely on managing the lifetime of state, so jotai and other
state management libraries are still valuable.\
You can typically use jotai or something, and when lifetime management becomes
necessary, you can wrap those states with bunja.

## How to use

Bunja basically provides two functions: `bunja` and `useBunja`.\
You can use `bunja` to define a state with a finite lifetime and use the
`useBunja` hook to access that state.

### Defining a Bunja

You can define a bunja using the `bunja` function. When you access the defined
bunja with the `useBunja` hook, a bunja instance is created.\
If all components in the render tree that refer to the bunja disappear, the
bunja instance is automatically destroyed.

If you want to trigger effects when the lifetime of a bunja starts and ends, you
can use the `bunja.effect` function.

```ts
import { bunja } from "bunja";
import { useBunja } from "bunja/react";

const countBunja = bunja(() => {
  const countAtom = atom(0);

  bunja.effect(() => {
    console.log("mounted");
    return () => console.log("unmounted");
  });

  return { countAtom };
});

function MyComponent() {
  const { countAtom } = useBunja(countBunja);
  const [count, setCount] = useAtom(countAtom);
  // Your component logic here
}
```

#### Seeding the first instance

If a bunja needs creation-time data, use `bunja.withSeed`. A default seed is
required when the bunja is declared, so callers may still omit the seed.

The seed is used only when a matching bunja instance is first created. It is not
part of the bunja instance identity. If the matching instance already exists,
later seeds are ignored.

Seeds can be supplied to `store.get`, `useBunja`, `bunja.use`, or `bunja.will`.

```ts
const formBunja = bunja.withSeed({ title: "" }, (seed) => {
  const titleAtom = atom(seed.title);
  return { titleAtom };
});

useBunja({ bunja: formBunja, seed: { title: "Draft" } });
```

### Defining a Bunja that relies on other Bunja

If you want to manage a state with a broad lifetime and another state with a
narrower lifetime, you can create a (narrower) bunja that depends on a (broader)
bunja. For example, you can think of a bunja that manages the WebSocket
connection and disconnection, and another bunja that subscribes to a specific
resource over the connected WebSocket.

In an application composed of multiple pages, you might want to subscribe to the
Foo resource on page A and the Bar resource on page B, while using the same
WebSocket connection regardless of which page you're on. In such a case, you can
write the following code.

```ts
// To simplify the example, code for buffering and reconnection has been omitted.
const websocketBunja = bunja(() => {
  let socket;
  const send = (message) => socket.send(JSON.stringify(message));

  const emitter = new EventEmitter();
  const on = (handler) => {
    emitter.on("message", handler);
    return () => emitter.off("message", handler);
  };

  bunja.effect(() => {
    socket = new WebSocket("...");
    socket.onmessage = (e) => emitter.emit("message", JSON.parse(e.data));
    return () => socket.close();
  });

  return { send, on };
});

const resourceFooBunja = bunja(() => {
  const { send, on } = bunja.use(websocketBunja);
  const resourceFooAtom = atom();

  bunja.effect(() => {
    const off = on((message) => {
      if (message.type === "foo") store.set(resourceAtom, message.value);
    });
    send("subscribe-foo");
    return () => {
      send("unsubscribe-foo");
      off();
    };
  });

  return { resourceFooAtom };
});

const resourceBarBunja = bunja(() => {
  const { send, on } = bunja.use(websocketBunja);
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

Notice that `websocketBunja` is not directly `useBunja`-ed. When you `useBunja`
either `resourceFooBunja` or `resourceBarBunja`, since they depend on
`websocketBunja`, it has the same effect as if `websocketBunja` were also
`useBunja`-ed.

> [!NOTE]
> When a bunja starts, the initialization effect of the bunja with a broader
> lifetime is called first.\
> Similarly, when a bunja ends, the cleanup effect of the bunja with the broader
> lifetime is called first.\
> This behavior is aligned with how React's `useEffect` cleanup function is
> invoked, where the parent’s cleanup is executed before the child’s in the
> render tree.
>
> See: <https://github.com/facebook/react/issues/16728>

#### Bunja init rules

Inside a bunja initialization function, call `bunja.use` and `bunja.will`
unconditionally and in the same order every time, similar to React's
[Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks). Do not put
them inside `if` statements, loops, or callbacks.

The target passed to `bunja.use` or `bunja.will` must be static. If you pass
scope value pairs as the second argument or through a bunja ref's `with` field,
the list of scope bindings must also be static. Do not choose a different bunja
or add/remove scope bindings based on runtime conditions.

`seed` is the exception. A bunja ref may provide a dynamic `seed` value because
seed is used only when creating the first matching bunja instance and is not
recorded in the dependency graph.

```ts
const consumerBunja = bunja.withSeed({ currentUserId: "" }, (seed) => {
  const getProfile = bunja.will({
    // Must stay the same on every init.
    bunja: profileBunja,
    with: [
      // Must stay the same on every init.
      LocaleScope.bind("en-US"),
    ],
    // May change for each first instance creation.
    seed: { currentUserId: seed.currentUserId },
  });

  return getProfile();
});
```

If a dependency should only be used for one branch, declare it with `bunja.will`
unconditionally, then branch on whether to call the returned thunk.

#### Conditional dependencies

Use `bunja.will` when a bunja may depend on another bunja only for a selected
branch. `bunja.will` declares a possible dependency and returns a thunk. Only a
called thunk becomes an active dependency and is mounted.

The thunk may only be called during the same bunja initialization function that
created it.

```ts
const resourceA = bunja(() => {
  const { send } = bunja.use(websocketBunja);
  bunja.effect(() => {
    send("subscribe-a");
    return () => send("unsubscribe-a");
  });
});

const resourceB = bunja(() => {
  const { send } = bunja.use(websocketBunja);
  bunja.effect(() => {
    send("subscribe-b");
    return () => send("unsubscribe-b");
  });
});

const selectedResourceBunja = bunja(() => {
  const selected = bunja.use(SelectedResourceScope);
  const useA = bunja.will(resourceA);
  const useB = bunja.will(resourceB);

  return selected === "a" ? useA() : useB();
});
```

When a `bunja.will` thunk is called, the selected dependency becomes part of the
current bunja instance. If that selected dependency resolves to a different
instance because of scope values, the current bunja also resolves to a different
instance.

A declared but uncalled `bunja.will` dependency has no effect on the current
bunja instance.

#### Prebaking the dependency graph

During normal `store.get` and `useBunja`, only the selected `bunja.will` branch
is baked. If a declared `bunja.will` dependency is not called, that dependency's
own dependencies may still be unknown. `store.prebake` can be used by devtools
or debugging code to visit those declared dependencies and fill in the graph.

Prebaking runs bunja init functions in a dry graph-collection mode. It does not
create ref-counted bunja instances, it does not mount dependencies, and it does
not run `bunja.effect` callbacks. Prebake still calls bunja init functions, so
put external resource creation and subscriptions inside `bunja.effect` if they
must not run during graph collection.

`store.prebake` rejects root bunja refs that provide a seed. During dry-run
initialization, bunja refs are converted to graph refs, so every prebaked bunja
is initialized with its declared default seed.

```ts
const result = store.prebake(selectedResourceBunja, readScope);

result.relatedBunjas;
result.requiredScopes;
```

The normal `store.get` and `useBunja` paths do not prebake automatically. They
still mount only the active `bunja.will` branch.

### Dependency injection using Scope

You can use a bunja for local state management.\
When you specify a scope as a dependency of the bunja, separate bunja instances
are created based on the values injected into the scope.

```ts
import { bunja, createScope } from "bunja";

const UrlScope = createScope();

const fetchBunja = bunja(() => {
  const url = bunja.use(UrlScope);

  const queryAtom = atomWithQuery((get) => ({
    queryKey: [url],
    queryFn: async () => (await fetch(url)).json(),
  }));

  return { queryAtom };
});
```

#### Injecting dependencies via React context

If you bind a scope to a React context, bunjas that depend on the scope can
retrieve values from the corresponding React context.

In the example below, there are two React instances (`<ChildComponent />`) that
reference the same `fetchBunja`, but since each looks at a different context
value, two separate bunja instances are also created.

```tsx
import { createContext } from "react";
import { bunja, createScope } from "bunja";
import { bindScope } from "bunja/react";

const UrlContext = createContext("https://example.com/");
const UrlScope = createScope();
bindScope(UrlScope, UrlContext);

const fetchBunja = bunja(() => {
  const url = bunja.use(UrlScope);

  const queryAtom = atomWithQuery((get) => ({
    queryKey: [url],
    queryFn: async () => (await fetch(url)).json(),
  }));

  return { queryAtom };
});

function ParentComponent() {
  return (
    <>
      <UrlContext value="https://example.com/foo">
        <ChildComponent />
      </UrlContext>
      <UrlContext value="https://example.com/bar">
        <ChildComponent />
      </UrlContext>
    </>
  );
}

function ChildComponent() {
  const { queryAtom } = useBunja(fetchBunja);
  const { data, isPending, isError } = useAtomValue(queryAtom);
  // Your component logic here
}
```

You can use the `createScopeFromContext` function to handle both the creation of
the scope and the binding to the context in one step.

```ts
import { createContext } from "react";
import { createScopeFromContext } from "bunja/react";

const UrlContext = createContext("https://example.com/");
const UrlScope = createScopeFromContext(UrlContext);
```

When using React 19, Bunja reads scope contexts lazily with `React.use`, so only
the contexts needed by the active branch are read. With React 18, Bunja must
read all bound contexts before resolving the bunja because `useContext` cannot
be called conditionally. In React 18, call `bindScope` before rendering.

#### Injecting dependencies directly into the scope

You might want to use a bunja directly within a React component where the values
to be injected into the scope are created.

In such cases, you can use the second parameter of `useBunja` hook to inject
values into the scope without wrapping the context separately.

```tsx
function MyComponent() {
  const { queryAtom } = useBunja(
    fetchBunja,
    [UrlScope.bind("https://example.com/")],
  );
  const { data, isPending, isError } = useAtomValue(queryAtom);
  // Your component logic here
}
```

##### Doing the same thing inside a bunja

You can pass scope value pairs as the second argument to `bunja.use` to override
scope values from within a bunja initialization function.

```ts
const myBunja = bunja(() => {
  const fooData = bunja.use(fetchBunja, [
    UrlScope.bind("https://example.com/foo"),
  ]);
  const barData = bunja.use(fetchBunja, [
    UrlScope.bind("https://example.com/bar"),
  ]);

  return { fooData, barData };
});
```
