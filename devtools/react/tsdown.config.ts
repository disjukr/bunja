import type { Options } from "tsdown";

const config: Options = {
  entry: [
    "brt.ts",
    "fiber/provider.tsx",
    "fiber/tag.ts",
    "hook.ts",
  ],
  clean: true,
  dts: true,
  format: ["esm"],
};

export default config;
