import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRichText, richPlainText, safeMediaUrl, youtubeEmbed } from '../lib/rich-text.ts';
import { postSchema, projectSchema } from '../lib/schema.ts';

test('Rich documents preserve plain posts and survive schema round trips with image frame choices', () => {
  const doc = readRichText('', 'First line\nSecond line');
  doc.content![0].content![0].marks = [{ type: 'bold' }, { type: 'underline' }];
  const richText = JSON.stringify(doc);
  assert.equal(richPlainText(richText), 'First line\nSecond line');
  assert.equal(
    postSchema.parse({ id: 'post', title: 'Post', richText, text: richPlainText(richText) })
      .richText,
    richText,
  );
  assert.equal(projectSchema.parse({ id: 'project', name: 'Project' }).imageFrame, 'square');
  for (const imageFrame of ['square', 'landscape', 'portrait', 'original'])
    assert.equal(
      projectSchema.parse({ id: 'project', name: 'Project', imageFrame }).imageFrame,
      imageFrame,
    );
});
test('Rich content rejects malformed/deep documents and unsafe media/embed destinations', () => {
  for (const value of ['null', '{}', '{"type":"doc","content":[{"type":"text","marks":{}}]}'])
    assert.deepEqual(readRichText(value, 'Fallback'), readRichText('', 'Fallback'));
  let deep: unknown = { type: 'text', text: 'deep' };
  for (let i = 0; i < 45; i++) deep = { type: 'doc', content: [deep] };
  assert.equal(richPlainText(JSON.stringify(deep)), '');
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.example',
    'https://user:pass@example.com',
  ])
    assert.equal(safeMediaUrl(url), undefined);
  assert.equal(
    youtubeEmbed('https://youtu.be/dQw4w9WgXcQ'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  );
  assert.equal(
    youtubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  );
  assert.equal(youtubeEmbed('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'), undefined);
  assert.equal(youtubeEmbed('https://www.youtube.com/watch?v=bad'), undefined);
});
