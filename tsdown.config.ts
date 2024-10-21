import type { Options } from "tsdown";

const config: Options = {
  entry: ["bunja.ts", "react.ts"],
  clean: true,
  dts: true,
  format: ["esm", "cjs"],
};

export default config;
