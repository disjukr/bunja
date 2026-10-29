import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(join(root, 'package.json'));
const coreRequire = createRequire(join(root, 'bunja/package.json'));
const temp = await mkdtemp(join(tmpdir(), 'bunja-package-'));
const run = (cmd, args, cwd = temp) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
try {
  run('pnpm', ['--dir', join(root, 'bunja'), 'pack', '--pack-destination', temp]);
  const archive = (await readdir(temp)).find(name => name.endsWith('.tgz'));
  assert.ok(archive);
  const contents = execFileSync('tar', ['-tzf', join(temp, archive)], { encoding: 'utf8' });
  assert.doesNotMatch(contents, /\.cjs|\.cts|(?:test|tsdown|tsconfig)\./);
  const dependencies = { bunja: `file:./${archive}` };
  for (const name of ['react', 'solid-js', '@types/react']) dependencies[name] = coreRequire(`${name}/package.json`).version;
  for (const name of ['typescript', 'esbuild']) dependencies[name] = require(`${name}/package.json`).version;
  await writeFile(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies }));
  // Offline install proves all consumer dependencies come from the workspace lockfile.
  const store = execFileSync('pnpm', ['store', 'path'], { cwd: root, encoding: 'utf8' }).trim();
  run('pnpm', ['install', '--offline', '--ignore-scripts', '--ignore-workspace', '--store-dir', dirname(store)]);
  const pkgDir = join(temp, 'node_modules/bunja');
  const pkg = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './react', './solid']);
  assert.doesNotMatch(JSON.stringify(pkg), /\.cjs|\.cts|"require"/);
  for (const entry of Object.values(pkg.exports)) {
    assert.deepEqual(Object.keys(entry), ['types', 'default']);
    await readFile(join(pkgDir, entry.types));
    await readFile(join(pkgDir, entry.default));
  }
  assert.match(await readFile(join(pkgDir, 'dist/react.js'), 'utf8'), /^['"]use client['"]/);
  await cp(join(root, 'scripts/consumer'), temp, { recursive: true });
  run(process.execPath, ['runtime.mjs']);
  run(process.execPath, ['--conditions=browser', 'runtime.mjs']);
  if (process.env.BUNJA_COMPAT_NODE) {
    run(process.env.BUNJA_COMPAT_NODE, ['runtime.mjs']);
    run(process.env.BUNJA_COMPAT_NODE, ['--conditions=browser', 'runtime.mjs']);
  }
  for (const [module, resolution] of [['NodeNext', 'NodeNext'], ['ESNext', 'Bundler']]) {
    run('pnpm', ['exec', 'tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', module, '--moduleResolution', resolution, 'types.ts']);
  }
  run('pnpm', ['exec', 'esbuild', 'types.ts', '--bundle', '--platform=browser', '--format=esm', '--outfile=bundle.js', '--define:process.env.NODE_ENV="production"']);
  console.log('Packed declaration consumers (NodeNext and Bundler) and browser bundling passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
