import { readFile, writeFile } from 'node:fs/promises';

const version = process.argv[2]?.replace(/^v/, '');
const hasInvalidPrerelease = version?.split('-').slice(1).join('-').split('.')
  .some(identifier => /^0[0-9]+$/.test(identifier));
if (!version || hasInvalidPrerelease || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)) {
  throw new Error('Usage: pnpm version:release <vX.Y.Z[-prerelease]>');
}
for (const file of ['../bunja/package.json', '../bunja/jsr.json']) {
  const url = new URL(file, import.meta.url);
  const metadata = JSON.parse(await readFile(url, 'utf8'));
  metadata.version = version;
  await writeFile(url, JSON.stringify(metadata, null, 2) + '\n');
}
