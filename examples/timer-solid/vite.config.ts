import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import deno from "@deno/vite-plugin";

export default defineConfig({
  plugins: [deno(), solid()],
});
