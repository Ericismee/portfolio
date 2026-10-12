# Verification

Run `npm run check` for lint, TypeScript and the maintained server tests in `tests/`. Run `npm run build` before deployment. Use `npm run security:source -- --history` and `npm audit` when reviewing publication or dependencies.

The tests cover authentication, CSRF, private/public content and files, concurrent saves, recovery, upload validation, GitHub data, language handling, themes and analytics. They use isolated temporary databases; never run test writes against owner or production data.

For browser checks, use an isolated browser session and test both languages and themes at 320, 390, 768 and 1440 pixels, including landscape. Check navigation, add/edit forms, unsaved changes, file previews, keyboard focus, upload errors, account forms and traffic filters. Verify that private pages and unpublished files reject anonymous requests.

Temporary browser scripts, images and logs named `.qa-*` are ignored by Git and deployment. They are disposable after verification. Do not confuse these artifacts with the maintained `tests/` directory. The previous static prototype and its obsolete browser scripts have been removed; supported entrypoints are `npm run dev` and `npm start`.

Documented screenshots under `docs/screenshots/` are reference assets, including the README image and security-review evidence. The retired `server.mjs` remains a small fail-closed compatibility guard, covered by a test. Neither replaces the Next.js server.

Passing automated checks does not establish that every device, assistive technology or external service has been tested.
