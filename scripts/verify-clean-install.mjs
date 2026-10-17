#!/usr/bin/env node
/** A fresh checkout simulation: no source node_modules, no cache reuse, frozen npm ci. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'splitreceipt-clean-'));
const checkout = path.join(workspace, 'checkout');
const cache = path.join(workspace, 'empty-npm-cache');
await fs.mkdir(checkout);
const entries = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'postcss.config.js', 'tailwind.config.js', 'index.html', 'foundry.toml', 'remappings.txt', 'src', 'contracts', 'lib', 'scripts', 'tests', 'tools', 'deployments'];
for (const name of entries) {
  await fs.cp(path.join(root, name), path.join(checkout, name), {
    recursive: true,
    filter: filename => !/\/(?:node_modules|out|cache|runs|\.git)(?:\/|$)/.test(filename),
  });
}
const lockHash = async () => createHash('sha256').update(await fs.readFile(path.join(checkout, 'package-lock.json'))).digest('hex');
const before = await lockHash();
const npm = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
async function command(args) {
  const startedAt = new Date().toISOString();
  const log = await fs.open(path.join(workspace, `${args[0]}-${args[1] ?? 'install'}.log`), 'w');
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npm, ...args], {
      cwd: checkout,
      env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` },
      stdio: ['ignore', log.fd, log.fd],
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code));
  });
  await log.close();
  if (exitCode !== 0) throw new Error(`${args.join(' ')} failed with exit ${exitCode}; see ${workspace}.`);
  return { command: `npm ${args.join(' ')}`, startedAt, finishedAt: new Date().toISOString(), exitCode };
}
const commands = [];
commands.push(await command(['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', cache, '--registry', 'https://registry.npmjs.org', '--fetch-retries', '1', '--fetch-timeout', '30000']));
commands.push(await command(['run', 'typecheck']));
commands.push(await command(['test']));
commands.push(await command(['run', 'build']));
const after = await lockHash();
if (before !== after) throw new Error('Frozen installation changed the lockfile.');
const report = { verifiedAt: new Date().toISOString(), node: process.version, source: root, workspace, checkout,
  initiallyEmptyPackageCache: true, noCopiedNodeModules: true, lockfileSha256: after, frozenLockfileUnchanged: true, commands };
await fs.mkdir(path.join(root, '.verification'), { recursive: true });
await fs.writeFile(path.join(root, '.verification/clean-install.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
