import type { UserConfig } from "tsdown";

const config: UserConfig = {
  entry: ["bunja.ts", "react.ts", "solid.ts"],
  clean: true,
  target: "es2022",
  platform: "neutral",
  dts: true,
  format: ["esm"],
};

export default config;
