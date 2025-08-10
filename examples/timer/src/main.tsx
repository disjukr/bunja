import { createContext } from "react";
import { createRoot } from "react-dom/client";
import { createStore, Provider as JotaiProvider } from "jotai";
import { bindScope, BunjaStoreProvider } from "bunja/react";
import { App } from "./App.tsx";
import { type JotaiStore, JotaiStoreScope } from "./state/jotai-store.ts";
import "./styles.css";

// Create a global jotai store instance
const jotaiStore = createStore();

// Create context for sharing the jotai store across bunja instances
const JotaiStoreContext = createContext<JotaiStore>(jotaiStore);

// Bind the bunja scope to the React context for dependency injection
bindScope(JotaiStoreScope, JotaiStoreContext);

createRoot(document.getElementById("root")!).render(
  <JotaiProvider store={jotaiStore}>
    <JotaiStoreContext.Provider value={jotaiStore}>
      <BunjaStoreProvider>
        <App />
      </BunjaStoreProvider>
    </JotaiStoreContext.Provider>
  </JotaiProvider>,
);
