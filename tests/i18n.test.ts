import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiLabel, sectionLabel, localizedError } from '../lib/i18n.ts';

test('Built-in labels translate while custom authored labels retain their text', () => {
  assert.equal(uiLabel('Đang phát triển', 'en'), 'In development');
  assert.equal(uiLabel('Đang phát triển', 'vi'), 'Đang phát triển');
  assert.equal(sectionLabel('Dự án', 'Dự án', 'en'), 'Projects');
  assert.equal(sectionLabel('Dự án', 'My selected work', 'en'), 'My selected work');
  assert.equal(uiLabel('My own status', 'en'), 'My own status');
});
test('Bilingual errors display only the selected language regardless of message order', () => {
  assert.equal(localizedError('Please sign in / Vui lòng đăng nhập', 'en'), 'Please sign in');
  assert.equal(localizedError('Please sign in / Vui lòng đăng nhập', 'vi'), 'Vui lòng đăng nhập');
  assert.equal(
    localizedError('File PDF không hợp lệ / Invalid PDF file', 'en'),
    'Invalid PDF file',
  );
  assert.equal(localizedError('Invalid JSON', 'vi'), 'Dữ liệu JSON không hợp lệ');
});
