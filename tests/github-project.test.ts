import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGithubProject, githubProjectQuery } from '../lib/github-project.ts';
import { applyGithubFields } from '../lib/github-project-fields.ts';

test('GitHub project import reads public metadata, languages and declared frameworks without following supplied URLs', async () => {
  const original = globalThis.fetch;
  const paths: string[] = [];
  const encoded = (text: string) => ({
    encoding: 'base64',
    content: Buffer.from(text).toString('base64'),
  });
  globalThis.fetch = async (input) => {
    const address = String(input);
    paths.push(address);
    if (address.endsWith('/languages')) return Response.json({ TypeScript: 900, CSS: 100 });
    if (address.endsWith('/readme'))
      return Response.json(
        encoded(
          '# Example\n\nA research tool for organising documents and finding answers.\n<img src="https://evil.test/x">\n[Guide](https://example.com)\n\n## Built With\nFastAPI\n\n## Install\nRun the app.',
        ),
      );
    if (address.endsWith('/contents/package.json'))
      return Response.json(
        encoded(JSON.stringify({ dependencies: { next: '1', react: '1', unknown: '1' } })),
      );
    return Response.json({
      name: 'example',
      description: null,
      language: 'TypeScript',
      private: false,
      fork: false,
      archived: false,
      homepage: 'https://demo.example.com',
      owner: { login: 'qa-project', type: 'User' },
      languages_url: 'https://evil.test/private',
    });
  };
  try {
    const result = await getGithubProject('qa-project', 'example');
    assert.equal(result.fields.tech, 'TypeScript');
    assert.equal(result.fields.technologies, 'TypeScript, CSS, Next.js, React, FastAPI');
    assert.ok(result.fields.description.startsWith('A research tool for organising documents'));
    assert.equal(result.fields.demo, 'https://demo.example.com');
    assert.equal(result.fields.source, 'https://github.com/qa-project/example#readme');
    assert.equal(result.ownership, 'owner');
    assert.equal(result.partial, false);
    assert.ok(result.fields.details.includes('A research tool for organising documents'));
    assert.ok(!result.fields.details.includes('<img'));
    assert.ok(paths.every((p) => p.startsWith('https://api.github.com/repos/qa-project/example')));
    await getGithubProject('qa-project', 'example');
    assert.equal(paths.length, 4);
  } finally {
    globalThis.fetch = original;
  }
});

test('GitHub import handles missing optional files and rejects private repositories, unsafe demos and invalid paths', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const address = String(input);
    if (/\/(languages|readme|contents\/package.json)$/.test(address))
      return Response.json({}, { status: 404 });
    return Response.json({
      name: 'partial',
      description: null,
      language: 'Python',
      private: address.includes('/private'),
      fork: true,
      archived: false,
      homepage: 'javascript:alert(1)',
      owner: { login: 'qa-partial', type: 'Organization' },
    });
  };
  try {
    const result = await getGithubProject('qa-partial', 'partial');
    assert.equal(result.fields.tech, 'Python');
    assert.equal(result.fields.details, '');
    assert.equal(result.fields.demo, '');
    assert.equal(result.ownership, '');
    assert.equal(result.partial, true);
    await assert.rejects(getGithubProject('qa-partial', 'private'));
    for (const repo of ['..', '../secret', 'name?url=https://evil.test'])
      assert.equal(githubProjectQuery.safeParse({ username: 'qa', repo }).success, false);
    assert.equal(githubProjectQuery.safeParse({ username: '../qa', repo: 'valid' }).success, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('Applying GitHub fields preserves authored content by default and never changes publication or identity', () => {
  const current = {
    name: 'My name',
    description: '',
    demo: 'https://kept.example',
    visible: false,
    id: 'kept',
  };
  const incoming = {
    name: 'Repo',
    description: 'Summary',
    demo: '',
    visible: 'true',
    id: 'changed',
    github: 'https://github.com/qa/repo',
  };
  const merged = applyGithubFields(current, incoming);
  assert.equal(merged.name, 'My name');
  assert.equal(merged.description, 'Summary');
  assert.equal(merged.demo, 'https://kept.example');
  assert.equal(merged.id, 'kept');
  assert.equal(merged.visible, false);
  assert.equal(applyGithubFields(current, incoming, true).name, 'Repo');
  assert.equal(current.description, '');
});
