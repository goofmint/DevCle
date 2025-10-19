import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function loadEnv(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`.env file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const delimiterIndex = trimmed.indexOf('=');
    if (delimiterIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, delimiterIndex).trim();
    const value = trimmed.slice(delimiterIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  const envPath = path.resolve(process.cwd(), '../.env.test');
  loadEnv(envPath);

  run('pnpm', ['db:seed']);
  run('pnpm', ['playwright', 'test']);
}

main();
