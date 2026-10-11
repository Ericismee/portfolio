import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, HttpError } from '../lib/database.ts';
import { githubCredential, saveGithubCredential } from '../lib/github-connection.ts';

test('GitHub credentials survive process restart with protected keys and authenticated ciphertext', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'profile-credential-'));
  const database = openDatabase(directory);
  const token = 'github_pat_test_only_never_a_real_token';
  const keyFile = path.join(directory, 'github-credential.key');
  try {
    await saveGithubCredential(database, token, 'test-account');
    assert.equal((await githubCredential(database)).token, token);
    const saved = database.db.prepare('SELECT secret FROM github_connection').get() as {
      secret: string;
    };
    assert.ok(saved.secret.startsWith('v2.'));
    assert.ok(!saved.secret.includes(token));
    if (process.platform === 'win32') {
      assert.ok(readFileSync(keyFile, 'utf8').startsWith('eric-profile:dpapi:v1:'));
      assert.notEqual(readFileSync(keyFile).length, 32);
    }
    // A fresh process cannot reuse the in-memory key cache. Only a digest of the
    // synthetic test token crosses argv; credentials never appear in output.
    const script = `import {openDatabase} from './lib/database.ts';
      import {githubCredential} from './lib/github-connection.ts';
      import {createHash} from 'node:crypto';
      const db=openDatabase(process.argv[1]);
      const credential=await githubCredential(db);
      const valid=credential.login==='test-account' && createHash('sha256').update(credential.token).digest('hex')===process.argv[2];
      db.db.close(); process.exit(valid?0:1);`;
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        script,
        directory,
        createHash('sha256').update(token).digest('hex'),
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 30000 },
    );
    assert.equal(child.status, 0, child.error?.message || 'Restart could not unlock credential');
    assert.equal(child.stdout, '');
    database.db.prepare('UPDATE github_connection SET login=?').run('other-account');
    await assert.rejects(
      () => githubCredential(database),
      (error) => error instanceof HttpError && error.status === 503,
    );
    database.db.prepare('UPDATE github_connection SET login=?').run('test-account');
    unlinkSync(keyFile);
    await assert.rejects(
      () => githubCredential(database),
      (error) => error instanceof HttpError && error.status === 503,
    );
    assert.throws(() => readFileSync(keyFile), { code: 'ENOENT' });
    assert.equal(
      (database.db.prepare('SELECT secret FROM github_connection').get() as { secret: string })
        .secret,
      saved.secret,
    );
  } finally {
    database.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Legacy GitHub keys and tokens migrate without requiring token entry; corruption fails closed', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'profile-credential-legacy-'));
  const database = openDatabase(directory);
  const keyFile = path.join(directory, 'github-credential.key');
  const token = 'github_pat_test_only_legacy_token';
  try {
    const key = randomBytes(32),
      iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(token), cipher.final()]);
    writeFileSync(keyFile, key, { mode: 0o600 });
    database.db.exec(
      'CREATE TABLE github_connection(id INTEGER PRIMARY KEY, secret TEXT NOT NULL, login TEXT NOT NULL)',
    );
    database.db
      .prepare('INSERT INTO github_connection VALUES(1,?,?)')
      .run(
        [iv, cipher.getAuthTag(), body].map((v) => v.toString('base64')).join('.'),
        'legacy-account',
      );
    assert.equal((await githubCredential(database)).token, token);
    const saved = (
      database.db.prepare('SELECT secret FROM github_connection').get() as { secret: string }
    ).secret;
    assert.ok(saved.startsWith('v2.'));
    if (process.platform === 'win32') assert.ok(!readFileSync(keyFile).equals(key));
    const parts = saved.split('.');
    const tag = Buffer.from(parts[2], 'base64');
    tag[0] ^= 1;
    parts[2] = tag.toString('base64');
    database.db.prepare('UPDATE github_connection SET secret=?').run(parts.join('.'));
    await assert.rejects(
      () => githubCredential(database),
      (error) => error instanceof HttpError && error.status === 503,
    );
    database.db.prepare('UPDATE github_connection SET secret=?').run(saved);
    writeFileSync(keyFile, 'corrupted-key');
    await assert.rejects(
      () => githubCredential(database),
      (error) => error instanceof HttpError && error.status === 503,
    );
    assert.equal(readFileSync(keyFile, 'utf8'), 'corrupted-key');
  } finally {
    database.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
