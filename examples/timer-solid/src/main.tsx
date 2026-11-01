import { render } from "solid-js/web";
import { BunjaStoreProvider } from "bunja/solid/v1-compat";
import { App } from "./App.tsx";
import "./styles.css";

render(
  () => (
    <BunjaStoreProvider>
      <App />
    </BunjaStoreProvider>
  ),
  document.getElementById("root")!,
);
