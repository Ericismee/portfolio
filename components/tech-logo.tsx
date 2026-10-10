'use client';
import { useState } from 'react';
const logos: Record<string, string> = {
  Python: 'python',
  TypeScript: 'typescript',
  Java: 'java',
  'C#': 'csharp',
  HTML: 'html5',
  JavaScript: 'javascript',
  CSS: 'css3',
  Dart: 'dart',
  'C++': 'cplusplus',
  C: 'c',
  'Jupyter Notebook': 'jupyter',
  Shell: 'bash',
  PowerShell: 'powershell',
  Vue: 'vuejs',
  Kotlin: 'kotlin',
  ShaderLab: 'unity',
  HLSL: 'unity',
  Rust: 'rust',
  PHP: 'php',
  Ruby: 'ruby',
  Swift: 'swift',
  Go: 'go',
  Dockerfile: 'docker',
  CMake: 'cmake',
  SCSS: 'sass',
  Sass: 'sass',
  R: 'r',
  Lua: 'lua',
  Markdown: 'markdown',
  Svelte: 'svelte',
  'Objective-C': 'objectivec',
  TeX: 'latex',
  Makefile: 'cmake',
  PLpgSQL: 'postgresql',
  Jinja: 'jinja',
  Batchfile: 'windows11',
  'Go Template': 'go',
};
export function TechLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  return logos[name] && !failed ? (
    <img
      className="tech-logo"
      src={'/tech/' + logos[name] + '.svg'}
      width={18}
      height={18}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="tech-logo-fallback" aria-hidden="true">
      {name.slice(0, 2)}
    </span>
  );
}
export function TechnologyChips({ names }: { names: string[] }) {
  return (
    <ul className="github-tech-chips">
      {names.map((name) => (
        <li key={name}>
          <TechLogo name={name} />
          {name}
        </li>
      ))}
    </ul>
  );
}
