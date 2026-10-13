import { readFile, writeFile } from 'node:fs/promises';
// Remove only declarations superseded by the exact same selector/property in
// the exact same conditional context. Preserve ordering and !important.
function parse(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 1,
      j = open + 1;
    for (; j < css.length && depth; j++) {
      if (css[j] === '{') depth++;
      if (css[j] === '}') depth--;
    }
    if (depth) throw Error('Unbalanced stylesheet');
    const body = css.slice(open + 1, j - 1);
    if (selector.startsWith('@media')) rules.push({ selector, children: parse(body) });
    else {
      if (selector.startsWith('@')) throw Error('Unsupported rule ' + selector);
      rules.push({
        selector,
        declarations: body
          .split(';')
          .map((s) => {
            const k = s.indexOf(':');
            return k < 0 ? null : [s.slice(0, k).trim(), s.slice(k + 1).trim()];
          })
          .filter(Boolean),
      });
    }
    i = j;
  }
  return rules;
}
const rules = parse(await readFile('src/app.css', 'utf8')),
  seen = new Map();
let removed = 0;
function prune(list, context = '') {
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (r.children) {
      prune(r.children, context + '|' + r.selector);
      continue;
    }
    r.declarations = r.declarations
      .reverse()
      .filter(([property, value]) => {
        const key = context + '|' + r.selector + '|' + property,
          important = /!important\s*$/.test(value),
          prior = seen.get(key);
        if (prior && (prior.important || !important)) {
          removed++;
          return false;
        }
        seen.set(key, { important });
        return true;
      })
      .reverse();
  }
}
function print(list, indent = '') {
  return list
    .map((r) => {
      if (r.children) {
        const body = print(r.children, indent + '  ');
        return body ? `${indent}${r.selector} {\n${body}\n${indent}}` : '';
      }
      return r.declarations.length
        ? `${indent}${r.selector} {\n${r.declarations.map(([k, v]) => `${indent}  ${k}: ${v};`).join('\n')}\n${indent}}`
        : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
prune(rules);
if (process.argv.includes('--write'))
  await writeFile(
    'src/app.css',
    '/* Shared components and responsive rules. */\n' + print(rules) + '\n',
  );
console.log(
  `${removed} superseded declarations${process.argv.includes('--write') ? ' removed' : ' can be removed'}.`,
);
