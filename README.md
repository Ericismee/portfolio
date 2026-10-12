# Eric Profile

A personal portfolio and publishing platform built with **Next.js, React and TypeScript**. Share projects, write posts and manage a professional profile through a private admin workspace.

[Live website](https://ericisme.cloud) · [Deployment guide](docs/VERCEL-DEPLOYMENT.md) · [Security](SECURITY.md) · [License](LICENSE)

![Desktop profile](docs/screenshots/profile-desktop.png)

## Features

- **Profile and projects** — cover, avatar, introduction, skills, custom sections, project details and searchable content.
- **Publishing** — rich text or Markdown with Edit / Preview, scheduled posts, visibility controls, duplicate checks and recoverable trash.
- **Administration** — inline editing, mobile full-screen forms, image framing and upload progress. Attach PDF, DOCX, TXT, Markdown and images with previews; uploads support up to 20 MiB (static SVG: 1 MiB). DOCX previews show text; download for original formatting. Text files use UTF-8.
- **GitHub integration** — public repositories, contributions and activity; authenticated imports stay private until explicitly published.
- **Analytics** — daily trends, country/device/browser breakdowns, filters and viewing duration. Visitor details are admin-only; the public counter exposes a total.
- **Presentation** — English by default, Vietnamese translation, light/dark themes and responsive layouts. Background updates pause while editing or when the tab is hidden.

Interface translations do not automatically translate authored posts or project descriptions. Analytics exclude signed-in administrators and recognized bots and deduplicate views per page within a 30-minute session.

## Stack

Next.js App Router · React · strict TypeScript · Zod · Tiptap · React Markdown · Node.js 24

Local development uses SQLite and disk uploads. Production on Vercel uses PostgreSQL and private Vercel Blob storage so content survives redeployment. Font files and technology icons are served locally.

## Run locally

Install **Node.js 24**, then:

```sh
npm ci
```

Copy `.env.example` to `.env`, keeping `PUBLIC_ORIGIN=http://localhost:3001`. Then create your own administrator and start the app:

```sh
npm run admin:create -- your-admin-name
npm run dev
```

Open [localhost:3001](http://localhost:3001); administration is at `/admin`. The CLI requests a password of 12–256 characters; terminal input is visible. No default administrator password is included. Re-running the command resets that account's password and invalidates its sessions.

## Deploy

For Vercel, configure these **server-only** environment variables:

- `DATABASE_URL` — PostgreSQL connection with verified TLS.
- `BLOB_READ_WRITE_TOKEN` — a private Vercel Blob store.
- `GITHUB_CREDENTIAL_KEY` — a persistent 32-byte encryption key, encoded as 64 hexadecimal characters.
- `PUBLIC_ORIGIN` — the exact canonical HTTPS origin, without a trailing slash.
- `BACKUP_ENCRYPTION_KEY` and `CRON_SECRET` — independent random secrets for encrypted daily backups and the authenticated scheduler; see [backup and recovery](docs/BACKUPS.md).

Never use a `NEXT_PUBLIC_` prefix for credentials. Keep preview and production resources separate, and back up the database, uploaded files and encryption key independently.

Follow the [deployment and migration guide](docs/VERCEL-DEPLOYMENT.md) for existing data, domain setup and recovery. **Deploying source does not synchronize a local database with production.** Self-hosting requires persistent storage; see [Dockerfile](Dockerfile) and [compose.yaml](compose.yaml).

## Development

```sh
npm run check   # Lint, type checking and automated tests
npm run build   # Production build
npm audit      # Known dependency advisories
npm run security:source -- --history  # Tracked files and local Git history
```

Server tests cover authentication, CSRF, access boundaries, upload privacy, concurrent writes, recovery and analytics. Passing tests and a clean dependency audit do not guarantee the absence of vulnerabilities.

## Security and privacy

Administrative reads require a server-validated session; writes also check Origin and CSRF. Session cookies are HttpOnly and Secure in production. Passwords use scrypt, while GitHub credentials and visitor IP/details are encrypted at rest.

Optional authenticator-based two-factor authentication includes single-use recovery codes. Enable it from Account & security. Login and contact requests have separate per-IP limits. Responsive WebP images retain publication checks, and SEO includes canonical URLs, a sitemap and genuine HTTP 404 responses. The original locally hosted fonts are preserved.

Visitor history is retained until explicitly removed through operational maintenance; there is no automatic retention expiry. IP-based locations are approximate, and browser-based tracking can be blocked or omitted. This dashboard is not a replacement for hosting access logs or firewall logs.

Environment files, databases, keys, backups and exports must remain outside Git. Review [SECURITY.md](SECURITY.md) before publishing a fork or reporting an issue.

## License and attribution

Original application code is licensed under [MIT](LICENSE). Dependencies, fonts and third-party artwork retain their respective licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The software license does not grant rights to personal profile content, photographs, third-party trademarks or owner-supplied artwork. Replace those assets in your own deployment. Screenshots illustrate this portfolio and are not a reusable asset pack.
