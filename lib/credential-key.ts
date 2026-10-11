import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const prefix = 'eric-profile:dpapi:v1:';
const cache = new Map<string, { stamp: string; key: Buffer }>();

// Fixed script; secret bytes travel through stdin, never command arguments,
// environment variables, temporary plaintext files or application logs.
function dpapi(value: Buffer, protect: boolean): Buffer {
  if (process.platform !== 'win32') throw Error('Windows credential protection unavailable');
  const executable = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $credentialBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $credentialEntropy=[Text.Encoding]::UTF8.GetBytes('Eric-Profile:GitHub-key:v1'); $credentialResult=[Security.Cryptography.ProtectedData]::${protect ? 'Protect' : 'Unprotect'}($credentialBytes,$credentialEntropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($credentialResult));`;
  const result = spawnSync(
    executable,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    {
      input: value.toString('base64'),
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 65536,
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0 || !/^[a-zA-Z0-9+/=]+$/.test(result.stdout.trim()))
    throw Error('Unable to access Windows credential protection');
  return Buffer.from(result.stdout.trim(), 'base64');
}
function encode(key: Buffer) {
  return process.platform === 'win32'
    ? Buffer.from(prefix + dpapi(key, true).toString('base64'))
    : key;
}
export function credentialKey(directory: string, create = false): Buffer {
  if (directory === 'cloud') {
    const encoded = process.env.GITHUB_CREDENTIAL_KEY || '';
    if (!/^[a-f0-9]{64}$/i.test(encoded))
      throw Error('Cloud credential encryption key is unavailable');
    return Buffer.from(encoded, 'hex');
  }
  const filename = path.resolve(directory, 'github-credential.key');
  let stored: Buffer;
  try {
    stored = readFileSync(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !create)
      throw Error('Credential key is unavailable');
    try {
      writeFileSync(filename, encode(randomBytes(32)), { flag: 'wx', mode: 0o600, flush: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    stored = readFileSync(filename);
  }
  if (process.platform !== 'win32' && (statSync(filename).mode & 0o777) !== 0o600)
    chmodSync(filename, 0o600);
  const stat = statSync(filename),
    stamp = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  const found = cache.get(filename);
  if (found?.stamp === stamp) return found.key;
  let key: Buffer;
  if (stored.subarray(0, prefix.length).toString() === prefix) {
    key = dpapi(Buffer.from(stored.subarray(prefix.length).toString(), 'base64'), false);
  } else if (stored.length === 32) {
    key = stored;
    if (process.platform === 'win32') {
      // Wrap the existing key without changing it: existing tokens keep working.
      // Atomic replacement preserves the original file if protection fails.
      const temporary = filename + '.' + randomBytes(8).toString('hex') + '.tmp';
      try {
        writeFileSync(temporary, encode(key), { flag: 'wx', mode: 0o600, flush: true });
        renameSync(temporary, filename);
      } finally {
        try {
          unlinkSync(temporary);
        } catch {
          // Cleanup must not obscure the original protection/write failure.
          // Any leftover temporary file contains only a DPAPI-wrapped key.
        }
      }
    }
  } else throw Error('Credential key format is invalid');
  if (key.length !== 32) throw Error('Credential key format is invalid');
  const finalStat = statSync(filename);
  if (cache.size >= 20) cache.delete(cache.keys().next().value!);
  cache.set(filename, {
    stamp: `${finalStat.mtimeMs}:${finalStat.ctimeMs}:${finalStat.size}`,
    key,
  });
  return key;
}
