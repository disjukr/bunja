import type { UserConfig } from "tsdown";

const config: UserConfig = {
  entry: [
    "brt.ts",
    "fiber/provider.tsx",
    "fiber/tag.ts",
    "hook.ts",
  ],
  clean: true,
  target: "es2022",
  platform: "neutral",
  dts: true,
  format: ["esm"],
};

export default config;
