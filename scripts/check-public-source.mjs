import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A deliberately bounded check for private files and recognizable credentials.
// It supplements manual review; it is not a general secret-detection engine.
export function privateSourcePath(filename) {
  const normalized = filename.replaceAll('\\', '/');
  const parts = normalized.split('/');
  return (
    parts.some((part) => ['.data', '.vercel', 'backups', 'exports'].includes(part)) ||
    parts.some((part) => /^\.env(?:\.|$)/.test(part) && part !== '.env.example') ||
    /\.(?:sqlite[^/]*|db(?:-wal|-shm)?|key|pem|p12|pfx|sql(?:\.gz)?)$/i.test(normalized)
  );
}

export function sourceSecretFindings(filename, text) {
  const rules = [
    ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
    ['Blob token', /\bvercel_blob_rw_[A-Za-z0-9_]{20,}\b/g],
    ['Neon password', /\bnpg_[A-Za-z0-9]{12,}\b/g],
    ['database credentials', /postgres(?:ql)?:\/\/[^\s:'"<>]+:[^\s@'"<>]{6,}@[^\s'"<>]+/g],
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
    ['JWT', /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g],
  ];
  const findings = [];
  for (const [kind, pattern] of rules) {
    for (const match of text.matchAll(pattern)) {
      // Exact, deliberately synthetic fixture used by the mocked GitHub tests.
      if (
        filename.startsWith('tests/') &&
        match[0] === ['github_pat', 'qa_connection_secret_123456789'].join('_')
      )
        continue;
      findings.push({ kind, line: text.slice(0, match.index).split('\n').length });
    }
  }
  return findings;
}

function run() {
  const git = (args, options = {}) =>
    execFileSync('git', args, { maxBuffer: 128 * 1024 * 1024, ...options });
  const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .toString()
    .split('\0')
    .filter(Boolean);
  const findings = [];
  for (const filename of files) {
    if (privateSourcePath(filename)) findings.push({ file: filename, kind: 'private file' });
    const bytes = readFileSync(filename);
    if (!bytes.subarray(0, 8000).includes(0))
      for (const finding of sourceSecretFindings(filename, bytes.toString()))
        findings.push({ file: filename, ...finding });
  }
  let blobs = 0;
  if (process.argv.includes('--history')) {
    const historicalPaths = new Set(
      git(['log', '--all', '--format=', '--name-only', '--diff-filter=AM'])
        .toString()
        .split('\n')
        .filter(Boolean),
    );
    for (const filename of historicalPaths)
      if (privateSourcePath(filename))
        findings.push({ file: filename, kind: 'historical private path' });
    const objects = git(['rev-list', '--objects', '--all']).toString().trim().split('\n');
    const names = new Map(
      objects.map((line) => {
        const split = line.indexOf(' ');
        return split < 0 ? [line, ''] : [line.slice(0, split), line.slice(split + 1)];
      }),
    );
    const raw = git(['cat-file', '--batch'], { input: [...names.keys()].join('\n') + '\n' });
    let offset = 0;
    while (offset < raw.length) {
      const end = raw.indexOf(10, offset);
      const [oid, type, length] = raw.subarray(offset, end).toString().split(' ');
      const bytes = raw.subarray(end + 1, end + 1 + Number(length));
      offset = end + 2 + Number(length);
      if (type !== 'blob') continue;
      blobs += 1;
      const filename = names.get(oid) || '(historical blob)';
      if (privateSourcePath(filename))
        findings.push({
          file: filename,
          object: oid.slice(0, 10),
          kind: 'historical private file',
        });
      if (!bytes.subarray(0, 8000).includes(0))
        for (const finding of sourceSecretFindings(filename, bytes.toString()))
          findings.push({ file: filename, object: oid.slice(0, 10), ...finding });
    }
  }
  if (findings.length) {
    // Never print matched values: CI output may itself be public.
    console.error(JSON.stringify({ findings }, null, 2));
    process.exitCode = 1;
  } else
    console.log(
      `Public-source check passed: ${files.length} tracked/unignored files${blobs ? ` and ${blobs} historical blobs` : ''}. No recognized credentials or private paths found.`,
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
