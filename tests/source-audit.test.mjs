import assert from 'node:assert/strict';
import test from 'node:test';
import { privateSourcePath, sourceSecretFindings } from '../scripts/check-public-source.mjs';

test('Public-source checks reject private files while allowing documented examples and licenses', () => {
  for (const name of [
    '.env',
    '.env.local',
    '.data/profile.sqlite',
    '.vercel/project.json',
    'exports/visitors.json',
    'backups/profile.json',
    'recovery.key',
    'dump.sql',
  ])
    assert.equal(privateSourcePath(name), true, name);
  for (const name of [
    '.env.example',
    'README.md',
    'lib/credential-key.ts',
    'public/tech/LICENSE.txt',
  ])
    assert.equal(privateSourcePath(name), false, name);
});

test('Credential findings reveal only categories and line numbers, including credentials in test files', () => {
  const synthetic = 'ghp_' + 'a'.repeat(36);
  const findings = sourceSecretFindings('tests/untrusted.test.ts', '\n' + synthetic);
  assert.deepEqual(findings, [{ kind: 'GitHub token', line: 2 }]);
  assert(!JSON.stringify(findings).includes(synthetic));
  assert.equal(
    sourceSecretFindings(
      'docs/example.md',
      'postgresql://' + 'user:example-password@db.example/test',
    ).length,
    1,
  );
  assert.equal(
    sourceSecretFindings('docs/example.md', '-----BEGIN ' + 'PRIVATE KEY-----').length,
    1,
  );
});

test('Only the exact known mocked token is exempted, and only inside tests', () => {
  const fixture = 'github_pat_qa_connection_secret_123456789';
  assert.deepEqual(sourceSecretFindings('tests/api.test.ts', fixture), []);
  assert.equal(sourceSecretFindings('lib/api.ts', fixture).length, 1);
  assert.equal(sourceSecretFindings('tests/api.test.ts', fixture + 'unexpected').length, 1);
});
