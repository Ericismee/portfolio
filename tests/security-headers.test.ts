import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentSecurityPolicy } from '../lib/security-headers.ts';

test('Production CSP trusts only a per-request nonce and blocks injected script attributes', () => {
  const policy = contentSecurityPolicy('c3ludGhldGljLW5vbmNl');
  const scripts = policy.split('; ').find((directive) => directive.startsWith('script-src '))!;
  assert.match(scripts, /'nonce-c3ludGhldGljLW5vbmNl'/);
  assert.match(scripts, /'strict-dynamic'/);
  assert.ok(!scripts.includes('unsafe-inline'));
  assert.ok(!scripts.includes('unsafe-eval'));
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.equal(contentSecurityPolicy().split('; ')[1], "script-src 'self'");
  assert.throws(() => contentSecurityPolicy("bad'nonce"));
});

test('Development debugging allowances never change the production policy', () => {
  assert.match(contentSecurityPolicy('', true), /'unsafe-eval'/);
  assert.ok(!contentSecurityPolicy('bm9uY2U=').includes('unsafe-eval'));
});
