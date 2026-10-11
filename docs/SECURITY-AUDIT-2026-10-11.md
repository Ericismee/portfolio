# Functional and security verification — 11 October 2026

## Conclusion

The tested local application passes its automated checks and production build after the fixes below. This is evidence for the tested paths, not an ASVS certification or a claim that every possible attack has been excluded. Production approval remains conditional on the deployment checks listed under limitations.

The owner's development service on port 3001, real content, GitHub connection and sessions were not reset or used as attack fixtures. Browser and HTTP write tests used the isolated production preview on port 3002 and synthetic data. Automated tests use temporary SQLite databases. Third-party GitHub behavior was mocked; no notifications or external mutations were sent.

## System inventory

- Frontend: Next.js 16.4 App Router, React 19, TypeScript, local CSS/fonts, reusable inline and dashboard editors. Markdown uses react-markdown/GFM; rich text uses Tiptap and a constrained document renderer.
- Backend: Node.js 24 Route Handlers, Zod validation, SQLite content document with optimistic version checks, administrator accounts, sessions, contact messages and retained revisions. There is no independent production worker or scheduled job. Publication time is evaluated on reads.
- Files: persistent DATA_DIR/uploads, random UUID names, signature/MIME checks, bounded request streams, publication-aware reads. Images/PDF/JSON file inputs support 20 MiB; Markdown body fields retain their 30,000-character application limit.
- Authentication: scrypt password hashes, opaque session tokens stored as SHA-256 digests, 12-hour sessions, per-session CSRF, exact production Origin checks. No JWT or refresh-token flow. No default administrator password.
- GitHub: authenticated administrator discovery/import, separate public summaries; AES-256-GCM token storage with account-bound authenticated data. Windows protects the credential key with CurrentUser DPAPI. Public summaries do not return authenticated private repository discovery.
- Deployment: standalone Next build, persistent SQLite disk, single-instance deployment design, non-root Docker runtime, loopback default local binding. Remote TLS termination and backups are outside the local environment.
- CI: Node 24, npm ci, lint/types/tests, production dependency audit and Next build; read-only repository permission and disabled persisted checkout credentials.
- Retired code: root server.mjs now fails closed. Historical backend modules/static mock files are not served by Next or selected by current npm/Docker entrypoints. The administrator .mjs alias delegates to the current CLI.

### Pages and endpoints

Public pages: / and /profile, /projects and /projects/:id, /activity and /feed, /posts/:id, /contact, /github, /search. /admin loads an authentication-gated client workspace. Nonpublic project/post detail URLs return 404 to guests.

Public API: GET /api/content, GET /api/session, GET /api/github (validated year), POST /api/login, POST /api/contact. Upload reads use GET /uploads/:filename and may require an administrator session.

Administrator API: GET/PUT /api/admin/content; POST /api/admin/upload, /import, /restore, /logout; GET /api/admin/revisions; GET/DELETE /api/admin/messages; GET/POST/DELETE /api/admin/github-connection; GET /api/admin/github, /github-repositories and /github-project. Unsupported paths/methods return 404. Every administrator read checks the server session; every mutation additionally checks Origin and session CSRF.

### Role × resource × action matrix

| Resource / action | Guest | Admin A | Admin B | Evidence |
| --- | --- | --- | --- | --- |
| Published content / read and search | Allowed | Allowed | Allowed | Public projection, discovery and HTTP checks |
| Draft, hidden, future and deleted content / private read | Denied | Allowed | Allowed | Anonymous/forged-session endpoint tests |
| Content / add, edit, hide, delete, restore, import | Denied | Allowed | Allowed | API lifecycle, CSRF, version-conflict and browser checks |
| Contact / submit | Allowed, bounded | Allowed, bounded | Allowed, bounded | Validation and persistent rate-limit tests |
| Inbox / read and delete | Denied | Allowed | Allowed | Endpoint and inbox lifecycle tests |
| GitHub token / connect or disconnect | Denied | Allowed | Allowed | Session/Origin/CSRF and encryption tests |
| GitHub token / retrieve plaintext from API/export | Denied | Denied | Denied | Connection response, content and revision boundaries |
| Private GitHub repository / discover or import | Denied | Allowed within token grants | Allowed within token grants | Mocked credential/private-import tests |
| Unpublished upload / download | Denied, 404 | Allowed | Allowed | Publication/revocation/traversal tests |
| Another session / CSRF or logout replay | Denied | Cannot use B's CSRF or revoke B via own logout | Cannot use A's CSRF or revoke A via own logout | Two-account regression |

A and B intentionally administer the same personal website, inbox and GitHub connection. This is not a multitenant product: shared content access between administrators is authorized by the current model. Session A cannot substitute its CSRF for B, and logging out A leaves B's session active. If independent tenant data is later introduced, it needs a separate ownership model and tests.

## Confirmed findings and fixes

### AUD-01 — Obsolete alternate server bypassed current upload privacy — Medium

- Location: former root server.mjs upload handler; historical backend/content.mjs projection. Prerequisite: an operator explicitly runs the obsolete server rather than supported Next entrypoints. The active Next upload handler already enforced publication checks.
- Safe reproduction: with an isolated old-server database, upload an unpublished synthetic file, then request its returned URL without cookies. The former handler read it directly without a session or public-reference check. Source review confirmed the unconditional branch; the owner server was not exercised this way.
- Impact/root cause: a guessed or disclosed file URL could expose an unpublished upload when the obsolete runtime is deployed. Its duplicated backend also had outdated privacy rules and size limits.
- Fix: the obsolete executable and exported factory fail closed with a migration message. The old administrator CLI routes to the current implementation. Supported deployment uses npm run dev / npm start / Docker Next output.
- Retest: tests/server.test.mjs asserts the exported factory rejects and direct execution exits 1. Current API lifecycle and upload authorization tests remain active. HTTP requests to /server.mjs and /backend/database.mjs return 404.
- Status: **fixed and retested**. Historical modules remain source-only; they must not become a new custom entrypoint.

### AUD-02 — Abuse limits reset with API/process recreation — Medium

- Location: lib/api.ts createApi rate-limit state.
- Safe reproduction: exhaust a synthetic login/contact bucket, create another API handler using the same database, and retry. The former in-memory map began empty. It also shared a single low login allowance among all account names.
- Impact/root cause: reload/restart could bypass limits; attempts for one name consumed every administrator's small shared allowance.
- Fix: SQLite atomically increments bounded-window buckets, cleans expired rows and preserves limits across handlers/processes. Login has a hashed-account bucket (30 attempts/15 minutes) and a wider global circuit breaker (300/15 minutes). Contact retains its global 30/15-minute policy. Login request bodies are capped at 16 KiB before password verification.
- Retest: blocked login remains 429 after handler recreation and database reopen; another administrator can still log in; expired bucket resumes; oversized login body returns 413. Contact accepts 30 requests, rejects request 31 and handler reload, then resumes after expiration without deleting saved messages.
- Status: **fixed and retested**. Global circuit breakers can still constrain all clients during sustained abuse; a trusted reverse proxy/WAF is a deployment consideration, not an unverified claim of per-IP protection.

### AUD-03 — CI did not validate the active application — Low

- Location: .github/workflows/webpack.yml.
- Safe reproduction/evidence: the previous workflow selected Node 18/20/22 and invoked webpack, while package.json requires Node 24 and the application builds with Next.
- Impact/root cause: the configured pipeline could fail or omit the real application checks, allowing regressions to miss CI validation.
- Fix: Node 24, npm ci, npm run check, npm audit --omit=dev --audit-level=high and npm run build; least-privilege workflow configuration.
- Retest: equivalent local checks passed; workflow configuration reviewed. A remote GitHub Actions run was not dispatched, so remote execution is **not verified**.
- Status: **configuration fixed; local equivalent verified**.

### AUD-04 — Rejected imports left newly created files on disk — Low

- Location: lib/api.ts import handler and lib/uploads.ts embedded-asset migration. Administrator access and valid CSRF are prerequisites.
- Safe reproduction: import an embedded synthetic image together with an invalid required profile field, a later invalid embedded file, or a stale document version. The migration previously wrote the image before the content write failed.
- Impact/root cause: repeated failed imports accumulated unreferenced files, although publication-aware file reads kept them inaccessible to guests.
- Fix: track only files created by the current import, await asset writes sequentially so cleanup cannot race pending writes, and remove those files if migration/validation/version checks reject the import. Existing uploads are never cleanup targets.
- Retest: schema rejection and partial-asset failure return 400; stale version returns 409. Each case leaves the existing upload and document unchanged and removes the import's new files.
- Status: **fixed and retested**. Abrupt process termination or a filesystem failure can still require maintenance of unreferenced files; no quota/garbage collector is claimed.

### FUNC-01 — Inconsistent content management and missing duplicate protection — Low

- Location: components/admin.tsx, components/inline-edit.tsx, components/skill-manager.tsx, lib/content-management.ts, lib/database.ts, lib/schema.ts.
- Safe reproduction: inline entry lists previously lacked the same hide/delete actions available in advanced administration; skills lacked a complete individual manager. Newly added equivalent names/repositories were accepted without a common server-side duplicate rule.
- Impact/root cause: confusing management, accidental duplicates and inconsistent recovery/visibility behavior across duplicated UI paths.
- Fix: shared searchable skill manager with add/edit/hide/show/delete; each section has its own entry/configuration list; inline entries expose compact edit/hide/delete controls; shared recoverable trash for projects/posts/custom entries. Skill/section changes remain recoverable through document revisions. Removed the unused skills toolbar save button.
- Duplicate rules: canonical repository URLs, normalized project/skill/section names, built-in English/Vietnamese section aliases, identical post content and custom-entry title/organization/period. Previously existing duplicates can be edited or reduced; different posts for one repository remain allowed. Rejection occurs server-side before version/revision changes. GitHub import marks repositories already referenced.
- Privacy: hidden skills and a hidden Skills section are removed from public JSON; administrator data is preserved.
- Retest: duplicate write leaves version/revisions intact; bilingual section aliases rejected; hidden skill projection and bounded trash tested. Browser added/edited/hid/showed/deleted a skill, showed duplicate feedback, added a custom section/entry, hid/showed/deleted it and restored it as a draft.
- Status: **fixed and retested**. Profile/contact/appearance are singleton forms, not duplicate collections. Inbox is received correspondence with list/read/delete, rather than invented add/edit/hide controls for visitor-authored messages.

### FUNC-02 — Markdown editing and previews differed between content types — Low

- Location: components/markdown-editor.tsx, components/admin-form.tsx, components/admin.tsx, app/globals.css, components/profile-site.tsx.
- Safe reproduction: post and project administration used different edit/preview paths; project previews could show source syntax as plain text.
- Fix: shared Edit/Preview tabs for Markdown posts and project details in dashboard and inline forms, GFM renderer for saved/read/import previews, plain-text preservation for manual mode. .md import opens Preview and validates limits without silently truncating or replacing content on an invalid file. Form submission from Preview keeps the body. Keyboard tab semantics and unsaved-change protection retained. Theme menu now reads Sáng / Tối or Dark / Light.
- Retest: browser rendered headings, bold, table, list and fenced code; ArrowRight switched tabs; imported a synthetic .md file, saved from Preview, reopened and verified preserved content. Project Markdown and manual plain-text previews showed their respective formats. Closing a changed form prompted Continue editing / Discard changes.
- Status: **fixed and retested**.

## Verification scope and results

| Area | Checks performed | Result / boundary |
| --- | --- | --- |
| Automated suite | All current .test.ts and .test.mjs files via npm run check | **55 tests, 55 pass**, lint and strict types pass |
| Formatting / build | Prettier active application, git diff --check, Next production build | Pass; no public .next/static source-map files emitted |
| Credentials / sessions | scrypt, token digest, production cookie/origin, expiry query, logout, two admins, mixed CSRF, SQL-like login | Tested paths pass; no signup/reset/MFA flow exists |
| Authorization / privacy | All private GET routes anonymous and forged; mutations without session/CSRF; drafts/hidden/scheduled/trash; public SSR props | Pass for fixtures and inspected handlers |
| Content integrity | CRUD, schedule, sort/filter/search, optimistic conflicts, invalid imports/restores, revisions, duplicates | Pass; stale version returns 409; limits 30 revisions/100 trash entries |
| Files | Signature/MIME checks, exact 20 MiB PDF/GIF and one-byte-over limits, original bytes, traversal, publication/revocation/logout | Pass; signature validation is not antivirus scanning or a full document parser |
| Markdown / rich text | GFM syntax, unsafe URLs/raw HTML, constrained/deep documents, image/embed URLs, relative README links | Pass tested payloads; imported raw HTML is omitted |
| GitHub | Fixed destination/path validation, private imports only for admin, missing README/files, upstream rate limits/failure/cache, encrypted token restart/tamper/migration | Mocked tests pass; live token grants and real private repositories not probed |
| Runtime HTTP | 6 private routes →401; 5 sensitive/path probes →404; 4 public pages →200 with headers; anonymous write/cross-origin login →403 | Pass on isolated final preview; private fixture markers absent |
| Browser E2E | .md import/Preview/save/reopen; keyboard; plain vs Markdown; skill CRUD/duplicate; section entry hide/show/delete/restore; unsaved warning; theme label | Pass for the recorded local interactions |
| Responsive / accessibility | Desktop screenshot, narrower approximately 777 CSS-pixel layout, labeled tabs/form controls, keyboard tab navigation | No overflow observed in inspected layout; exact 390-pixel mobile emulation could not be established in current browser tooling |
| Dependency audit | npm audit --json, prod+dev installed lockfile | 0 reported advisories; 372 total dependencies in audit metadata; point-in-time database result |
| Secret exposure | Tracked sensitive filenames; all local Git-ref patch history patterns for GitHub tokens, AWS access IDs and private-key headers; response/export boundaries | No matching real-format credential patterns or tracked sensitive files found; heuristic scan is not universal secret detection |
| Infrastructure / CI | Docker/compose/start/config review; local equivalent checks | Non-root/loopback/persistent-disk design reviewed; remote runtime, workflow execution and Linux container not run |

Screenshots: screenshots/markdown-preview-desktop-2026-10-11.png and screenshots/markdown-preview-narrow-2026-10-11.png. They contain synthetic QA content. The narrower screenshot is not represented as a 390-pixel device test.

## Risks and unverified boundaries

1. **Production deployment — not verified.** No remote server, reverse proxy, TLS certificate, host/database ACL, cloud bucket or restore target was available. Check HTTPS, persistent volume permissions, encrypted backups and a restore drill before exposing administration. SQLite is designed here for one instance with durable local storage.
2. **Authentication features — absent, not passed.** Signup, self-service password recovery and MFA are not implemented. Admin provisioning/password reset uses the local CLI and revokes sessions. All administrators share a site-wide authority boundary.
3. **CSP defense in depth.** Production script policy still allows unsafe-inline for the current Next implementation; unsafe-eval is development-only. A tested nonce-based CSP would strengthen defense in depth. Sanitized Markdown/rich rendering remains the primary tested injection control.
4. **Credential key portability.** Windows DPAPI protection is tied to the operating-system user. Linux uses a permission-restricted key file, not DPAPI or an external KMS. Host compromise or a backup containing both key and encrypted database is outside token-at-rest confidentiality guarantees. Key migration/backups must be handled deliberately.
5. **Resource limits are finite, not load-test guarantees.** Content bodies are bounded, arrays are schema-limited, files are capped, and abuse buckets persist. No high-volume load, slow-client, disk-exhaustion or distributed attack test was run. File quotas/cleanup, malware scanning and proxy-level throttling are not implemented. Rejected imports now clean up their newly generated assets; interrupted processes or cancelled standalone uploads can still leave unreferenced files. Publication checks prevent guest access to such files.
6. **UI scope.** Exact 390-pixel mobile emulation was unavailable: the current in-app browser did not establish the requested width, and Chrome was unavailable through the browser connector. Existing small-screen CSS was reviewed, but device/touch/screen-reader/full WCAG certification is not claimed. There is no server-side paginated content UI; collections are bounded and searched/filtered client-side.
7. **External services and remote CI.** Real GitHub rate-limit capacity, token scope, organization SSO and network reliability depend on the connected account. They were simulated, not attacked. No actual GitHub Actions run, Docker build or production network scan was launched. Third-party action tags remain a supply-chain hardening consideration.
8. **Scanning limits.** Zero dependency advisories and zero matched credential patterns do not rule out unknown vulnerabilities, alternate secret formats or secrets in inaccessible remote history. No generic command/template/webhook exploit test is reported where no corresponding application execution surface exists; source review found fixed credential-protection subprocess commands, parameterized SQLite queries and no webhook endpoint.

## Readiness and next gate

The current supported local Next runtime is ready for review against the tested functionality. There is no confirmed unresolved Critical/High issue on the exercised active routes. This is not unconditional production approval: verify deployment TLS, volume/backup/key permissions, remote CI and a real mobile device before release. Keep the retired server disabled and preserve the authorization/privacy regression suite.

Methodology references: [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/), [OWASP API Security Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x03-introduction/), and [OWASP ASVS 5.0](https://owasp.org/projects/asvs?tab=main). These informed the checks; this report does not claim exhaustive control-by-control ASVS certification.
