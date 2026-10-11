import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { themeBootstrap, THEME_STORAGE_KEY } from '../lib/theme.ts';

test('The head bootstrap selects the saved theme synchronously without an intermediate theme', () => {
  for (const [initial, saved, expected] of [
    ['light', 'dark', 'dark'],
    ['dark', 'light', 'light'],
    ['dark', null, 'dark'],
    ['light', null, 'light'],
    ['dark', 'unexpected', 'dark'],
  ]) {
    const changes: unknown[] = [];
    let theme = initial;
    const root = {
      dataset: {
        get theme() {
          return theme;
        },
        set theme(value) {
          theme = value;
          changes.push(value);
        },
      },
      style: { colorScheme: '' },
    };
    runInNewContext(themeBootstrap, {
      document: { documentElement: root },
      localStorage: {
        getItem(key: string) {
          assert.equal(key, THEME_STORAGE_KEY);
          return saved;
        },
      },
    });
    assert.equal(root.dataset.theme, expected);
    assert.equal(root.style.colorScheme, expected);
    assert.deepEqual(changes, [expected]);
  }
});

test('The server theme remains usable when browser storage is blocked', () => {
  for (const theme of ['light', 'dark']) {
    const root = { dataset: { theme }, style: { colorScheme: '' } };
    runInNewContext(themeBootstrap, {
      document: { documentElement: root },
      localStorage: {
        getItem() {
          throw Error('Storage blocked');
        },
      },
    });
    assert.equal(root.dataset.theme, theme);
    assert.equal(root.style.colorScheme, theme);
  }
});
