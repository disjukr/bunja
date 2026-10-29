import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const root = dirname(import.meta.dirname);
const consumer = await mkdtemp(join(tmpdir(), "bunja-consumer-"));
const fromRoot = createRequire(join(root, "package.json"));
const fromBunja = createRequire(join(root, "bunja/package.json"));

function run(command, args, cwd = consumer) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

async function installConsumer() {
  run("pnpm", ["pack", "--pack-destination", consumer], join(root, "bunja"));
  const archive = (await readdir(consumer)).find(name => name.endsWith(".tgz"));
  assert.ok(archive, "pnpm pack did not create a tarball");

  const files = execFileSync("tar", ["-tzf", join(consumer, archive)], {
    encoding: "utf8",
  });
  assert.doesNotMatch(files, /\.cjs|\.cts|(?:test|tsdown|tsconfig)\./);

  const dependencies = { bunja: `file:./${archive}` };
  for (const name of ["react", "solid-js", "@types/react"]) {
    dependencies[name] = fromBunja(`${name}/package.json`).version;
  }
  for (const name of ["typescript", "esbuild"]) {
    dependencies[name] = fromRoot(`${name}/package.json`).version;
  }
  await writeFile(join(consumer, "package.json"), JSON.stringify({
    private: true,
    type: "module",
    dependencies,
  }));

  // Reuse tarballs, but allow fetching metadata absent from frozen CI installs.
  const store = execFileSync("pnpm", ["store", "path"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  run("pnpm", [
    "install", "--prefer-offline", "--no-frozen-lockfile",
    "--ignore-scripts", "--ignore-workspace", "--store-dir", dirname(store),
  ]);
  await cp(join(root, "scripts/consumer"), consumer, { recursive: true });
}

async function checkExports() {
  const packageDir = join(consumer, "node_modules/bunja");
  const read = path => readFile(join(packageDir, path), "utf8");
  const metadata = await read("package.json");
  const pkg = JSON.parse(metadata);

  assert.equal(pkg.type, "module");
  assert.deepEqual(Object.keys(pkg.exports).sort(), [".", "./react", "./solid"]);
  assert.doesNotMatch(metadata, /\.cjs|\.cts|"require"/);
  for (const entry of Object.values(pkg.exports)) {
    assert.deepEqual(Object.keys(entry), ["types", "default"]);
    await read(entry.types);
    await read(entry.default);
  }
  assert.match(await read("dist/react.js"), /^["']use client["']/);
}

function checkRuntime(node) {
  run(node, ["runtime.mjs"]);
  run(node, ["--conditions=browser", "runtime.mjs"]);
}

function checkTypesAndBundle() {
  for (const [module, resolution] of [["NodeNext", "NodeNext"], ["ESNext", "Bundler"]]) {
    run("pnpm", [
      "exec", "tsc", "--noEmit", "--strict", "--target", "ES2022",
      "--module", module, "--moduleResolution", resolution, "types.ts",
    ]);
  }
  run("pnpm", [
    "exec", "esbuild", "types.ts", "--bundle", "--platform=browser",
    "--format=esm", "--outfile=bundle.js", '--define:process.env.NODE_ENV="production"',
  ]);
}

try {
  await installConsumer();
  await checkExports();
  checkRuntime(process.execPath);
  if (process.env.BUNJA_COMPAT_NODE) checkRuntime(process.env.BUNJA_COMPAT_NODE);
  checkTypesAndBundle();
  console.log("Packed exports, runtime, declaration and bundler checks passed.");
} finally {
  await rm(consumer, { recursive: true, force: true });
}
