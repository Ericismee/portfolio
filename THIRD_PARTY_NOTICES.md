# Third-party notices

The [MIT license](LICENSE) applies to original application code. It does not replace licenses or trademark rights belonging to third parties.

## Bundled fonts and technology icons

- **Plus Jakarta Sans** — SIL Open Font License 1.1. [Project](https://github.com/tokotype/PlusJakartaSans); [included license](src/fonts/plusjakartasans-OFL.txt).
- **JetBrains Mono** — SIL Open Font License 1.1. [Project](https://github.com/JetBrains/JetBrainsMono); [included license](src/fonts/jetbrainsmono-OFL.txt).
- **Devicon v2.17.0 technology icons** — MIT. [Source and mappings](public/tech/SOURCES.md); [included license](public/tech/LICENSE.txt).
- **Simple Icons v15.18.0 Jinja icon** — CC0 1.0. [Source](https://github.com/simple-icons/simple-icons/blob/15.18.0/icons/jinja.svg); [included license](public/tech/SIMPLE-ICONS-LICENSE.md).

Technology logos identify their respective products. Their use does not imply endorsement or confer trademark rights.

## Software dependencies

Dependency versions are recorded in [package-lock.json](package-lock.json). Installed packages contain their own license and, where applicable, NOTICE files. Preserve those when redistributing packages, compiled client assets or a container image.

- Next.js, React, Tiptap, React Markdown, remark-gfm, Zod and postgres use MIT licenses in the audited lockfile.
- [fflate](https://github.com/101arrowz/fflate) and [xmldom](https://github.com/xmldom/xmldom) use MIT licenses; retain their supplied notices when redistributing document preview code.
- [PDF.js](https://github.com/mozilla/pdf.js), Vercel Blob and several supporting packages use Apache-2.0. Retain the applicable license, attribution and NOTICE files when redistributing their code.
- Next.js optionally installs [sharp](https://github.com/lovell/sharp) (Apache-2.0) and platform-specific [libvips binaries](https://github.com/lovell/sharp-libvips) with LGPL-3.0-or-later notices. Availability depends on platform. Redistributing those binaries or images containing them requires preserving their licenses and satisfying the applicable corresponding-source/relinking obligations; the application MIT license does not override them.
- [caniuse-lite](https://github.com/browserslist/caniuse-lite) data uses CC-BY-4.0. Other transitive packages include ISC, BSD-3-Clause, 0BSD and Unlicense components. Keep their supplied notices with redistributed material.

This summary is a source-level inventory, not a substitute for reviewing the actual platform-specific binary distribution and its bundled notices.

## Profile content, screenshots and favicon

Profile text, photographs, project branding and screenshots are content assets, separate from the reusable application code. References to projects do not grant rights to their logos or documents.

The current favicon files (`app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`) derive from an owner-supplied `linux.png`. Its upstream author and redistribution license were not established during this review. Do not assume it is covered by the application's MIT license; confirm permission or replace it with artwork whose rights are documented before redistributing a complete asset bundle.

Review screenshots for personal data and third-party artwork before republishing them. Forks should supply their own identity, images and branding.
