import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxMailLink } from '../lib/inbox-mail.ts';
const message = {
  id: 1,
  name: 'Nguyễn & Han',
  email: 'visitor+contact@example.com',
  subject: 'Hợp tác & hỗ trợ?\r\nBcc: hidden@example.com',
  message: 'Dòng một\n<script>alert(1)</script> &bcc=other@example.com',
  created_at: '2026-10-13T08:00:00.000Z',
};
test('Reply encodes recipient and text without introducing mail headers', () => {
  const url = new URL(inboxMailLink(message, 'reply'));
  assert.equal(decodeURIComponent(url.pathname), message.email);
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
  assert.equal(url.searchParams.get('subject'), 'Re: ' + message.subject.replace(/[\r\n]+/g, ' '));
  assert.ok(
    url.searchParams.get('body')?.includes('> <script>alert(1)</script> &bcc=other@example.com'),
  );
  assert.ok(!url.searchParams.get('subject')?.includes('\n'));
});
test('Forward leaves recipient empty and preserves the complete original message', () => {
  const url = new URL(inboxMailLink(message, 'forward'));
  assert.equal(url.pathname, '');
  assert.ok(url.searchParams.get('subject')?.startsWith('Fwd: '));
  assert.ok(url.searchParams.get('body')?.includes(message.message));
  assert.ok(url.searchParams.get('body')?.includes(message.email));
});
