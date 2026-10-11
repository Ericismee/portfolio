# Eric Profile

A personal profile and publishing website built with **Next.js, React, strict TypeScript and Node.js**. It combines a familiar professional profile layout with a private administration area for managing content without editing code.

**Production:** [ericisme.cloud](https://ericisme.cloud) · [Administration](https://ericisme.cloud/admin). PostgreSQL and private Blob storage are provisioned and the local data has been migrated. DNS is managed at iNET; `www` redirects to the main domain.

**Local website:** [localhost:3001](http://localhost:3001) · **Administration:** [localhost:3001/admin](http://localhost:3001/admin)

## Features

- Public profile with avatar, cover, introduction, social links and an optional downloadable PDF CV.
- Projects with images, technologies, descriptions, individual contribution fields, source/demo links and featured pinning.
- Posts with text, an image, a link, drafts, publishing and editable display time. Future posts remain private until their scheduled time.
- Experience, education, certifications and custom profile sections with editable entries.
- Search, project filters, grid/list presentation, reorder controls and individual visibility settings.
- Authenticated administration with server-side authorization, CSRF checks and HttpOnly session cookies.
- Password visibility controls and private account settings for username, account email and password. Changes require the current password and rotate all sessions; account email is separate from public contact information and is not a password recovery service.
- Persistent SQLite and disk uploads locally, or PostgreSQL and private Vercel Blob storage in the cloud. Cloud data survives redeployments.
- Deleted entries can be restored from trash as drafts. The last 30 document revisions are available for full recovery.
- Contact form that saves real messages to the private administration inbox.
- Public eye-icon visit counter and private traffic dashboard with historical profile/page/session counts, encrypted IP addresses and browser/device details retained indefinitely without automatic deletion. Administrator sessions are excluded.
- English by default with a remembered Vietnamese/English interface choice, light/dark themes, readable accent colors, density and standard/wide layout settings.
- Explicit import of the previous browser mock or a JSON export, including embedded image/PDF migration.

GitHub links open the actual account and repositories. Public GitHub summaries, contribution history and language rankings use upstream data with explicit unavailable/stale states. An authenticated administrator can separately connect GitHub to import accessible public and private repositories; private repository discovery is never exposed by the public summary. Owner-authored descriptions and custom titles remain in their original language when switching the interface language.

## Screenshots

Screenshots are captured from the local production build using an isolated QA database. Example management entries shown there are test content.

![Desktop profile](docs/screenshots/profile-desktop.png)
![Mobile profile](docs/screenshots/profile-mobile.png)


## Stack

- Next.js App Router with server-rendered public pages and Node.js Route Handlers.
- React components and reusable typed administration forms.
- TypeScript in strict mode; Zod supplies validation and inferred domain types.
- Node.js 24 and its built-in SQLite driver.
- CSS design tokens, local Plus Jakarta Sans and JetBrains Mono fonts.
- ESLint, Prettier, Node's test runner and a browser QA script.

Local deployments use SQLite on persistent disk. Vercel deployments use the PostgreSQL adapter and private Vercel Blob storage; Vercel refuses to start without `DATABASE_URL` instead of silently writing to ephemeral disk.

See [Vercel deployment and recovery](docs/VERCEL-DEPLOYMENT.md). After migration, production is the authoritative data copy; local SQLite edits do not automatically sync to production.

## Local setup

Install **Node.js 24**, then run:

```sh
npm ci
npm run admin:create -- eric
npm run dev
```

The administrator command asks for a password of 12–256 characters. Terminal input is visible; alternatively supply `ADMIN_PASSWORD` through your secret manager. No default or shared password is built into the source. Re-running the command updates that user's password and invalidates their sessions.

Open [the website](http://localhost:3001) and [administration](http://localhost:3001/admin). The database is initialized automatically on first use; existing content is never replaced by startup seeds. The supplied sample posts start as drafts.

After signing in, return to the profile to edit in place. Small pencil buttons edit the adjacent section; camera buttons edit the avatar and cover. The navbar's **… → Settings → Profile sections** menu lets the administrator fill empty sections, edit hidden sections or add custom sections, without displaying placeholder cards to visitors. Section settings change the title, visibility and order. Changes save to the same database as the dashboard. Visitors see only published content and no editing controls or administration links. Appearance settings and sign out are also in the navbar **…** menu. Sign out there to return to visitor mode.

Image uploads include a framing preview: drag with a mouse or touch, use arrow keys to reposition (Shift for larger steps), and use the zoom slider. Avatar previews include a circular guide; covers use a 4:1 frame. Choose **Use this framing**, then **Save** to publish. Until framing is applied or cancelled, saving the form is disabled. Cancel keeps the saved image. Applied crops are exported as JPEG (800×800 avatars; 1600×400 covers); GIF uploads become still images. Reframing an existing image uses the saved crop, so choose the original file again to recover areas outside that crop.

## Environment

Copy `.env.example` to `.env` when configuration is needed. Keep `.env` and real passwords out of Git.

```dotenv
PUBLIC_ORIGIN=http://localhost:3001
DATA_DIR=.data
```

- `PUBLIC_ORIGIN`: exact browser origin without a trailing slash. Required for production writes. Use the actual HTTPS website origin when deployed.
- `DATA_DIR`: persistent location for `profile.sqlite`, its WAL files and the `uploads` directory. Default: `.data`.
- `PORT`: standalone server port; defaults to `3001`.
- `HOST`: standalone binding; defaults to `127.0.0.1`. Docker sets its generated server to `0.0.0.0`.
- `ADMIN_PASSWORD`: used only by the administrator setup command; never a browser-visible variable.
- `NEXT_TELEMETRY_DISABLED=1`: optional build/runtime telemetry setting.

Next.js loads local environment files in development. `npm start` loads `.env` before starting the standalone production server. Administrator CLI commands inherit `DATA_DIR` from the shell; if you use a custom location, supply that same value when creating the account.

## Administration

1. Sign in at `/admin`.
2. Use **Profile & contact** to update personal information, images, social links and the CV.
3. Use **Projects** or **Posts** to add, preview, edit, hide and delete entries. Select Draft or Publish in the form.
4. Use ↑ and ↓ to reorder entries. Scheduled posts use the timezone of your device when entered.
5. Use **Profile sections** to rename headings, reorder sections, toggle visibility or create a custom section. Its **Entries** button manages the entries inside it.
6. Use **Appearance & data** for theme, accent, density, layout, import/export and revision recovery.
7. Read contact messages in **Inbox** and restore deleted content from **Trash**.

Hiding a profile section affects its placement on the profile page; published projects and posts retain their dedicated pages. Hide or unpublish an individual entry to remove it from all public content.

Open an existing mock at the same browser origin and choose **Import previous demo** to migrate its `eric-profile-mock` localStorage data. For data from a different origin, import the exported JSON file instead. Import replaces the saved document after confirmation, retaining a recovery revision. JSON imports, PNG/JPEG/WebP/GIF images and PDF CV uploads support files up to 20 MB. Client and server both enforce the upload limit. Private repositories and unpublished content use a distinct amber palette in light and dark themes.

## Checks and production build

```sh
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm run check` runs lint, type checking and automated API/domain tests. `npm start` serves the standalone build and keeps the data directory outside `.next`.

The API tests use temporary databases. Browser QA uses a separate production preview on port `3002` and `.qa-next-data`; it must never point at production. See [validation details](docs/VALIDATION.md).

## Deployment

A Docker configuration is included for a single Node.js instance behind an HTTPS reverse proxy:

```sh
# Set PUBLIC_ORIGIN in the host environment or a private .env file.
docker compose up -d --build
# Create your account inside the persistent application environment.
docker compose exec profile node scripts/create-admin.ts eric
```

The container exposes port 3001 to loopback on the host. Configure your reverse proxy and HTTPS certificate for the selected domain, forwarding requests to `127.0.0.1:3001`. The `profile-data` named volume persists data between container rebuilds. Do not delete that volume when upgrading.

For a normal Node server, keep `DATA_DIR` outside release directories and use `npm ci`, `npm run build`, then `npm start` under your process manager. Restart the process after deploying the new build. On Windows, stop a running standalone server before rebuilding because it locks the build directory.

A real deployment still needs a host, a domain or provider URL, HTTPS, persistent storage and access to that environment. No production deployment or Docker execution has been verified in this workspace.

## Backup and recovery

For a complete backup, stop the application and copy the entire `DATA_DIR`, including the database and uploaded files. Keep backups private: they include drafts, messages, administrator password hashes and sessions. Restore the directory while the application is stopped.

JSON exports contain content and appearance settings, including drafts. They do not include uploaded files, accounts or inbox messages. Revision history is a convenience for content recovery, not a replacement for an off-host backup.

## Structure and conventions

```text
app/          Next.js pages, route handlers and application styles
components/   Public UI, administration, forms, language context and icons
lib/          Zod schemas, persistence, authentication, API and typed helpers
scripts/      Account setup, standalone startup and optional browser QA
tests/        Isolated authorization, content, upload and persistence tests
src/          Retained design assets, fonts and legacy mock reference modules
.data/        Private runtime data — ignored by Git
```

The active application code is in `app`, `components` and `lib`. The earlier buildless prototype and Node server remain for reference; `npm` application scripts run Next.js. See [ARCHITECTURE.md](ARCHITECTURE.md) for responsibilities, formatting rules, comments and migration requirements.

Public project summaries are based on the owner-provided GitHub repositories. [CONTENT-SOURCES.md](CONTENT-SOURCES.md) records sources and limits; personal roles or measured outcomes have not been invented.

## GitHub profile and technology sidebar

The profile connects to the configured public GitHub account automatically, without OAuth or a token. A compact card shows repository/star/follower counts and ten language chips with an expand-to-all control and local technology logos. **Explore GitHub** opens the public bio, location/company, join date, following/fork counts and searchable repositories with descriptions, topics, primary languages, stars, forks, archive/fork flags and update dates. Search matches names, languages and topics. The card remains accessible on mobile even though other sidebar cards are hidden.

Languages are ranked by summed source-code bytes from GitHub’s [repository languages endpoint](https://docs.github.com/en/rest/repos/repos#list-repository-languages), excluding forks and empty repositories. This describes code distribution, not proficiency or framework knowledge. Repository and profile data use the public [repository list](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user) and [user profile](https://docs.github.com/en/rest/users/users#get-a-user) endpoints. Existing site content and uploaded pictures are not overwritten by GitHub data.

The server paginates repositories, up to ten pages of 100, and requests languages four repositories at a time under a twelve-second deadline. A timeout, API limit, failed page or truncation is labelled as partial or unavailable. Private repositories, private account details and OAuth are outside this public integration. No full-account export is claimed.

Responses are cached in memory and under `DATA_DIR/github-cache` for one hour; unavailable responses expire after five minutes. No background worker is required: the next page request after expiry refreshes the data. Interface language, administrator section management, appearance settings and sign out remain in the navbar’s three-dot Settings menu.

### GitHub profile, contributions and activity

`/github` presents GitHub identity, the full detected technology stack, repository counts, featured repositories and tabs for all public repositories and activity. Search matches names/descriptions/languages/topics; sorting supports updates, stars and name. Logos are served locally from Devicon v2.17.0 and Simple Icons v15.18.0; source and licenses are in `public/tech`.

The yearly calendar reads GitHub’s public contribution HTML and extracts exact per-day counts, independent of the recent event stream. It includes contribution types beyond commits. Years are selectable; future dates remain blank. The parser requires every elapsed day of the selected year and fails closed on upstream markup changes. Calendar cells support pointer selection and arrow-key navigation. On narrow screens only the calendar itself scrolls horizontally.

The timeline loads up to 30 owner-authored commits on default branches from the six most recently updated, non-fork, non-archived public repositories. It is a recent sample, not a full-account commit export. Public events use the latest 100 events returned by GitHub’s [Events API](https://docs.github.com/en/rest/activity/events), whose retention and delivery latency are controlled by GitHub. Commit data uses the [commits endpoint](https://docs.github.com/en/rest/commits/commits#list-commits). No event counts are substituted for calendar contributions.

While visible, the page checks automatically, by default every hour (configurable to 5, 15, 30 or 60 minutes), and supports manual refresh. It pauses checks in hidden tabs and cancels in-flight requests when unmounted or changing years. Events use ETags and respect `X-Poll-Interval`; polling slows when the public API quota is low. Commits cache for five minutes, calendars for fifteen minutes, profile/technologies for one hour. Refresh checks these caches rather than bypassing GitHub’s limits. Snapshots persist under `DATA_DIR/github-cache`; failed updates retain labelled stale snapshots instead of fabricated zero counts. A manual refresh does not guarantee instant upstream delivery.

Admins can connect a GitHub account using a personal access token in **Admin → GitHub → Connect GitHub account**, or directly in a project/post import form. The connected account supplies the authenticated API budget and can import authorized private repositories into admin-only previews. Public feeds still exclude private repositories; applying an import never saves or publishes automatically. See [connection and credential storage instructions](docs/GITHUB-CONNECTION.md). This is token-based authentication, not OAuth. The authenticated path is covered with mocked responses; no real owner token was entered during validation.

Alternatively configure `GITHUB_TOKEN` on the server. It is sent only to `api.github.com`, never returned to the browser or sent to the public calendar source. A UI connection takes precedence; disconnecting returns to the environment token if configured. Do not use a `NEXT_PUBLIC_` prefix.


### Administrator GitHub settings

After signing in, open **Settings (⋯) → GitHub settings**, the inline settings button on `/github`, or the **GitHub** tab in `/admin`. The same form manages the public account, page title/description, refresh interval and visibility of the sidebar, overview statistics, technologies, calendar, featured repositories, repository tab, commits and events.

Load repositories before saving a different username. Changing accounts clears the previous hidden/featured selections; Reset restores the unsaved form. Account lookup is authenticated, validated and limited to public GitHub data. Repository choices are saved with the existing version check, session and CSRF protections, and remain after restarting the server. The inline form protects unsaved changes on close.

Repositories can be hidden individually; forks can be excluded as a group. Featured repositories can be selected manually (up to twelve) and ordered with the move buttons. An empty manual selection stays empty. Newly discovered repositories are visible by default; newly discovered repositories are not automatically pinned in manual mode. This changes presentation on this website only.

Public server rendering and refresh responses filter hidden repositories and their owner-account commit/event records. The private repository list remains available only to administrators. Account-wide contribution and language totals are intentionally not recalculated when a repository is hidden. The recent commit source remains a bounded six-repository sample; hiding a source repository does not expand that sample. The public account and repositories remain accessible on GitHub itself.

The configured cadence applies while `/github` is visible. It is a browser-driven refresh, not an hourly background job when the site is closed. Upstream cache expiry, quota and polling limits still apply. Manual refresh checks the same caches. The compact profile card uses server-loaded data and updates on page reload/navigation.


## Shared editing and audit

Markdown posts and project details use the same keyboard-accessible **Edit / Preview** tabs in both inline editing and administration. Markdown mode can open a local `.md` file directly into preview. Plain project details retain line breaks; imported READMEs render headings, lists, tables, links and code. File inputs support 20 MiB; Markdown content retains the existing 30,000-character limit and rejects a longer file without replacing the form.

Skills have their own searchable add/edit/hide/delete list. Sections expose their own entry lists and configuration, including hide/show and removal. Project/post/custom-entry deletion uses shared recoverable trash; section and skill changes can also be recovered from document revisions. The server rejects newly introduced duplicate project names/repositories, section names (including built-in English/Vietnamese aliases), skills, identical posts and custom-entry identities. Existing duplicates may be edited or reduced. Different posts about the same repository remain supported.

Use `npm run dev` or `npm start`. The obsolete root `server.mjs` fails closed; it is not a supported deployment entrypoint. The old administrator `.mjs` command delegates to the current TypeScript implementation. Login/contact limits persist in SQLite across API reloads and restarts.

See [the 11 October 2026 functional and security audit](docs/SECURITY-AUDIT-2026-10-11.md) for evidence, scope and deployment limitations.
