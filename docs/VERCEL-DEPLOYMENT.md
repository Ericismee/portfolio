# Durable Vercel deployment

The application supports PostgreSQL for content, administrators, sessions, revisions, messages, rate limits and encrypted GitHub credentials. Private Vercel Blob stores uploads. PostgreSQL connections require TLS with certificate verification.

## Required server environment

- `DATABASE_URL`: PostgreSQL connection URL, preferably a pooled Neon URL.
- `BLOB_READ_WRITE_TOKEN`: token for a **private** Vercel Blob store.
- `GITHUB_CREDENTIAL_KEY`: 32 random bytes encoded as 64 hexadecimal characters. Keep the same key across redeployments. Back it up separately from the database. Losing it requires reconnecting GitHub; replacing it does not decrypt existing credentials.
- `PUBLIC_ORIGIN`: the exact production HTTPS origin, without a trailing slash. Administration writes from another origin are rejected.

Never prefix these variables with `NEXT_PUBLIC_`. Keep production database and Blob credentials out of preview environments. Use separate stores and keys for previews. Do not commit environment files or `.data`.

## Migrate an existing local website

Pause local editing for the migration. Retain a backup of the original `.data` directory. The source remains read-only throughout migration.

1. Provision an empty PostgreSQL database and a private Blob store.
2. Save the destination credentials in an ignored private environment file, such as `.env.cloud.local`.
3. Inspect counts without transmitting data: `npm run data:migrate`.
4. Apply: `node --env-file=.env.cloud.local scripts/migrate-cloud.ts --apply`.
5. The command copies content, administrator password hashes, the last revisions, inbox messages and upload files. It verifies uploaded file bytes on retries and compares the saved document after migration. It refuses to overwrite an already populated destination.
6. Deploy, sign in again using the existing administrator account, and reconnect GitHub. Local sessions and the local GitHub token are intentionally not migrated.

Do not continue editing both copies after migration. Keep the original backup until the deployed site, file previews, downloads and administration have been verified.

## Upload behavior

Files and JSON imports up to 20 MiB upload directly into private staging storage using a short-lived token restricted to one filename, MIME type and size. Finalization requires the same administrator, a valid session and CSRF token. The server validates file signatures before creating a permanent immutable upload. Staged files cannot be served by the website. Abandoned staging uploads are cleaned on subsequent uploads after their tokens expire.

Public upload URLs stay `/uploads/<uuid>.<extension>`. The server checks whether the current public document references a file before streaming it to visitors. Administrators can also access their unpublished files. Blob store tokens and upstream URLs never need to be exposed to visitors. Download responses remain uncached and private.

## Recovery and limits

Use the administration JSON export for content recovery and keep an independent backup of PostgreSQL and Blob assets. Document revisions retain the last 30 saved documents; they are not a replacement for database and asset backups. Provider retention and recovery capabilities depend on the chosen plan.

Cloud saves use a database transaction and optimistic version checks. A stale window receives a conflict instead of overwriting newer content. Startup initialization never replaces existing content. A missing production database fails closed.

Ordinary document saves larger than 3 MiB automatically use the same private staging transport to avoid Vercel's request body limit, while preserving version conflict checks and normal save semantics. File uploads, JSON imports and large documents support up to 20 MiB. Very large collections may require splitting the document model in a later migration.

## Deployment verification

- Run `npm run check`, `npm run format:check` and `npm run build`.
- Confirm anonymous requests cannot read administrator content, revisions, inbox messages, GitHub credentials or unpublished assets.
- Confirm public profile, projects, posts, Markdown, CV preview and downloads work.
- Confirm an administrator can save, reload, upload and sign out, and that data survives a new deployment.
- Attach the custom domain using the DNS records Vercel assigns, then update `PUBLIC_ORIGIN` to that domain and redeploy.
