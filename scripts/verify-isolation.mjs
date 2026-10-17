#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
assert.equal(lock.lockfileVersion, 3, 'Use the committed npm lockfile.');
assert.equal(lock.packages['node_modules/@openzeppelin/contracts'].version, '5.1.0');
let registryPackages = 0;
for (const [name, value] of Object.entries(lock.packages)) {
  if (!name) continue;
  assert.equal(value.link, undefined, `Filesystem-linked dependency: ${name}`);
  if (value.resolved) {
    assert.equal(new URL(value.resolved).origin, 'https://registry.npmjs.org', `Unexpected dependency source: ${name}`);
    assert.match(value.integrity ?? '', /^sha512-/, `Missing integrity: ${name}`);
    registryPackages++;
  }
}
const prohibitedInstalledPackages = ['connectkit', '@metamask/sdk', '@coinbase/wallet-sdk', '@walletconnect/ethereum-provider', '@base-org/account', '@circle-fin/app-kit'];
for (const name of prohibitedInstalledPackages) {
  assert.equal(lock.packages[`node_modules/${name}`], undefined, `Unused wallet/service SDK in lockfile: ${name}`);
}
let internalLinks = 0;
async function checkLinks(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (['.git', '.cache', '.verification'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const target = await fs.realpath(filename);
      assert(!path.relative(root, target).startsWith('..') && target !== root, `Dependency link leaves project: ${filename}`);
      internalLinks++;
    } else if (entry.isDirectory()) await checkLinks(filename);
  }
}
await checkLinks(root);
const runtimeFiles = ['package.json', 'tsconfig.json', 'vite.config.ts', 'foundry.toml', 'remappings.txt'];
async function sourceFiles(directory) {
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const filename = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await sourceFiles(filename);
    else if (/\.(?:ts|tsx|mjs|js|sol)$/.test(entry.name)) runtimeFiles.push(filename);
  }
}
await sourceFiles('src');
await sourceFiles('tools');
for (const filename of runtimeFiles) {
  assert(!/arcpreflight|studio-trial-2026|\/Users\/|LIVE_API_KEY:/i.test(await fs.readFile(path.join(root, filename), 'utf8')), `Runtime source contains an unrelated project/private path: ${filename}`);
}
console.log(JSON.stringify({ independent: true, registryPackages, internalNpmBinLinks: internalLinks,
  externalFilesystemLinks: 0, unusedServiceSdks: 0, checkedRuntimeFiles: runtimeFiles.length }, null, 2));
