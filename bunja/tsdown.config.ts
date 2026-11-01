import type { UserConfig } from "tsdown";

const config: UserConfig = {
  entry: ["bunja.ts", "react.ts", "solid.ts"],
  clean: true,
  target: "es2022",
  platform: "neutral",
  dts: true,
  format: ["esm"],
};

const configs: UserConfig[] = [config, {
  ...config,
  entry: ["solid/v1-compat.ts"],
  outDir: "dist/solid",
  clean: false,
  tsconfig: "solid/tsconfig.json",
  plugins: [{
    name: "external-core",
    resolveId(source: string) {
      if (source === "../bunja.ts") return { id: "../bunja.js", external: true };
    },
  }],
}];

export default configs;
