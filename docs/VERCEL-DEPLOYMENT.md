# Durable Vercel deployment

## Deployment overview

The reference website uses Vercel with PostgreSQL and private Blob storage in Singapore. A fork must create its own project, stores, credentials and administrator rather than reuse the reference site's resources.

The canonical origin is `https://ericisme.cloud`. DNS currently points directly to Vercel: `@ A 76.76.21.21` and `www CNAME 33662806d70b3314.vercel-dns-017.com.`. Vercel redirects `www` to the canonical origin. These records are public infrastructure information, not application credentials. For another project, copy the exact records shown in its Vercel Domains settings; keep mail records separate.

Keep a verified, independent backup of the encryption key outside Git and outside the database backup. A Windows DPAPI-protected local copy requires the same user's protection context and is not, by itself, a portable disaster-recovery backup. GitHub credentials must be reconnected if they were not migrated.

Production is the authoritative data copy after migration. Local SQLite changes do not automatically synchronize to it. Verify sign-in, upload, editing, published and unpublished file access after provisioning your own environment.

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

Administrators can update their own username, private account email and password in **Account & security**. Every change requires the current password, a valid session and CSRF token, and is rate limited. SQLite/PostgreSQL transactions reject duplicate usernames and stale sessions, revoke the account's previous sessions, preserve pending upload ownership when renaming, and rotate the current cookie/CSRF token. Passwords use scrypt with a fresh salt. Account email is not used for sign-in or password recovery; it is excluded from public content and content-only JSON exports. Cloud migrations preserve this private metadata separately.

Use the administration JSON export for content recovery and keep an independent backup of PostgreSQL and Blob assets. Document revisions retain the last 30 saved documents; they are not a replacement for database and asset backups. Provider retention and recovery capabilities depend on the chosen plan.

Cloud saves use a database transaction and optimistic version checks. A stale window receives a conflict instead of overwriting newer content. Startup initialization never replaces existing content. A missing production database fails closed.

Ordinary document saves larger than 3 MiB automatically use the same private staging transport to avoid Vercel's request body limit, while preserving version conflict checks and normal save semantics. File uploads, JSON imports and large documents support up to 20 MiB. Very large collections may require splitting the document model in a later migration.

## Traffic statistics

The public footer displays only the all-time visit count. A visit is a signed, HttpOnly cookie session lasting 30 minutes; each public path counts once per session. Profile views count `/` and `/profile`. Admin sessions and recognized crawlers are excluded. Counts start when this feature is deployed and are not historical estimates or unique-person counts.

The authenticated **Traffic statistics** admin section shows profile views, visits, page views, the last 24 hours, and searchable, paginated visitor details. Only Vercel's trusted client-IP header is accepted in production. IP addresses use AES-256-GCM with the protected server credential key; IP and browser/device details never appear in the public API. Detail requests require an administrator session. Browser/device classification is approximate and can be spoofed by clients.

Visitor history, encrypted IPs and supplementary metadata are retained indefinitely without automatic expiry. Empty date filters include the complete saved history; date ranges only restrict the report and never delete data. Previously scrubbed metadata cannot be reconstructed. The dashboard includes trend, device, country, software and page charts. The footer includes a bilingual privacy notice. Origin validation, bounded request bodies, signed cookies and per-IP rate limits protect the recording endpoint, but the counter is not an anti-fraud billing metric. Keep the server credential key and database backed up when rotating or migrating the deployment.

## Deployment verification checklist

- Run `npm run check`, `npm run format:check` and `npm run build`.
- Confirm anonymous requests cannot read administrator content, revisions, inbox messages, GitHub credentials or unpublished assets.
- Confirm public profile, projects, posts, Markdown, CV preview and downloads work.
- Confirm an administrator can save, reload, upload and sign out, and that data survives a new deployment.
- Attach the custom domain using the DNS records Vercel assigns, then update `PUBLIC_ORIGIN` to that domain and redeploy.
