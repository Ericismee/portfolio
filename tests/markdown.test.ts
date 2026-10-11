import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownUrl, projectUsesMarkdown } from '../lib/markdown.ts';
import { applyGithubPostFields, applyGithubFields } from '../lib/github-project-fields.ts';
import { postSchema } from '../lib/schema.ts';

test('GitHub Markdown renders headings, emphasis, lists, tables and fenced code without executing HTML', () => {
  const value =
    '# README\n\n**Bold**\n\n- First\n- Second\n\n| A | B |\n|---|---|\n| One | Two |\n\n```ts\nconst x = 1;\n```\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))';
  const html = renderToStaticMarkup(
    createElement(Markdown, {
      remarkPlugins: [remarkGfm],
      skipHtml: true,
      urlTransform: (v) => markdownUrl(v),
      children: value,
    }),
  );
  for (const expected of [
    '<h1>README</h1>',
    '<strong>Bold</strong>',
    '<ul>',
    '<table>',
    '<code class="language-ts">',
  ])
    assert.ok(html.includes(expected));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
});
test('README relative links and images resolve to their repository and reject unsafe URLs', () => {
  const base = 'https://github.com/owner/repo/blob/main/docs/README.md';
  assert.equal(markdownUrl('#setup', base), base + '#setup');
  assert.equal(
    markdownUrl('./shot.png', base, true),
    'https://raw.githubusercontent.com/owner/repo/main/docs/shot.png',
  );
  assert.equal(
    markdownUrl('../guide.md', base),
    'https://github.com/owner/repo/blob/main/guide.md',
  );
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:pass@example.com',
  ])
    assert.equal(markdownUrl(value, base), '');
  assert.equal(
    projectUsesMarkdown({
      details: '**Manual**',
      detailsFormat: 'plain',
      source: 'https://github.com/owner/repo#readme',
    }),
    false,
  );
  assert.equal(
    projectUsesMarkdown({
      details: '**Legacy import**',
      detailsFormat: 'auto',
      source: 'https://github.com/owner/repo#readme',
    }),
    true,
  );
});
test('Post import preserves manual content and publication; replacement retains Markdown and provenance through saving', () => {
  const current = {
    title: 'Authored title',
    richText: '{"type":"doc","content":[{"type":"text","text":"Manual"}]}',
    visibility: 'draft',
    bodyFormat: 'rich',
    link: '',
  };
  const incoming = {
    name: 'Repo',
    details: '# Title\n\n**Content**',
    detailsBase: 'https://github.com/owner/repo/blob/main/README.md',
    github: 'https://github.com/owner/repo',
  };
  const merged = applyGithubPostFields(current, incoming);
  assert.equal(merged.title, current.title);
  assert.equal(merged.bodyFormat, 'rich');
  assert.equal(merged.link, incoming.github);
  const replaced = applyGithubPostFields(current, incoming, true);
  assert.equal(replaced.visibility, 'draft');
  const saved = postSchema.parse({ ...replaced, id: 'post', text: replaced.markdown });
  assert.equal(saved.markdown, incoming.details);
  assert.equal(saved.markdownBase, incoming.detailsBase);
  assert.equal(saved.bodyFormat, 'markdown');
  const project = applyGithubFields({ details: 'Manual', detailsFormat: 'plain' }, incoming);
  assert.equal(project.detailsFormat, 'plain');
  assert.equal(applyGithubFields({ details: '' }, incoming).detailsFormat, 'markdown');
});
