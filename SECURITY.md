# Security

## Reporting an issue

For a suspected vulnerability, contact the maintainer privately through the contact link on [ericisme.cloud](https://ericisme.cloud). Do not include passwords, access tokens, visitor records or exploit details in a public issue. A report should describe the affected route, prerequisites, impact and a minimal reproduction using synthetic data.

## Before making a repository public

- Review both tracked files and the Git history. Ignoring a file does not remove an earlier commit.
- Keep `.env*` (except `.env.example`), `.data/`, `.vercel/`, credential keys, database dumps, backups, content exports and visitor records outside Git and deployment bundles.
- Use placeholders in examples and synthetic credentials in tests. Test passwords and mock tokens are never production credentials.
- Review screenshots, embedded image metadata, sample content and commit-author email addresses as well as text files. Public source and Git history make those visible.
- If a real secret was committed, revoke or rotate it first. Removing the current file is insufficient; history cleanup needs a coordinated migration for collaborators.
- Preserve third-party licenses and establish redistribution rights for artwork. Do not change repository visibility as part of an automated audit.

The application has no shared default administrator account. `package.json` uses `private: true` to prevent accidental npm publication; this does not control GitHub repository visibility.

## Deployment boundaries

Use one canonical HTTPS origin, a private Blob store and a TLS-verified PostgreSQL connection. Server secrets must not use `NEXT_PUBLIC_` names or be shared with untrusted preview deployments. Back up the encryption key separately: changing it prevents decryption of existing GitHub credentials and visitor details.

Session checks, CSRF, validation and persistent request limits are application controls. They complement the hosting firewall; they do not replace provider-level DDoS controls, account MFA, backups or monitoring. All administrators intentionally manage the same website and inbox; this is not a multitenant authorization model.

Production HTML uses a fresh cryptographic nonce for each request. Next.js and the theme bootstrap receive the nonce; arbitrary inline scripts and inline event handlers are blocked. The proxy replaces caller-supplied nonce headers. Development-only debugging allowances do not apply to production. Inline styles remain enabled for the editor and dynamic layout; Markdown, SVG and rich-content validation remain essential.

## Analytics boundaries

The public endpoint exposes aggregate visit counts, not visitor records. IP addresses and supplemental context are encrypted; country, browser, device, timestamp and page remain queryable analytics fields inside the private database. Stored visitor history has no automatic expiry.

Browser tracking records a visit only after its request reaches the application. Signed-in administrators and recognized bots are excluded; repeated views of one page in a 30-minute session are deduplicated. Blocked scripts, unavailable networks, failed tracking requests and pre-application firewall responses can create differences from edge-provider statistics.

DNS A/CNAME records and CDN addresses are public by design. A Vercel edge address does not disclose a private database endpoint, database password or a local computer's IP. DNSSEC and CAA require provider-compatible configuration; do not add or change them without checking the authoritative DNS and certificate setup.

## Validation

Run `npm run check`, `npm run build`, `npm audit` and `npm run security:source -- --history`. The source check screens tracked files and locally available Git history for private paths and recognizable credential formats; it does not detect every secret, image contents or sensitive prose. CI fetches full history before running it. Recheck anonymous access to private APIs and unpublished files after changing authentication, storage, routing or proxy settings. Audits are point-in-time checks, not a guarantee against all vulnerabilities.

### Analytics export checks

The analytics report and CSV export are both private reads: anonymous and forged-session requests must receive `401` without visitor data. CSV responses use `private, no-store`, attachment disposition and `nosniff`; export requests are rate limited. Text fields are quoted and spreadsheet formula prefixes (`=`, `+`, `-`, `@`), including leading whitespace, are neutralized before export. Treat downloaded files as private visitor records.

Review on 2026-10-13: the dependency audit reported no known advisories, and the source/history scan found no recognized credentials or private paths. Focused tests verified analytics authorization, encrypted visitor details, filter validation and CSV formula neutralization. This is a point-in-time review of these controls, not a penetration-test certification.

### Resource limits and adversarial validation

Public raster-image resizing accepts only the configured width presets, limits decoded images to 40 million pixels, runs at most two decoders concurrently and queues at most eight additional tasks per process. Excess work receives `503` with a short retry hint. Publication/session checks run before serving any cached image or `304` response. This is an application-level resource bound, not a substitute for an edge firewall or DDoS protection.

The 2026-10-13 hardening review additionally exercised all administrative mutation routes with missing sessions, missing CSRF and hostile origins; parser-injected scripts and event handlers under the production CSP; MFA replay/recovery controls; unpublished files and cached-image revocation; malformed documents, active SVG and DOCX ZIP bombs; encrypted backup integrity; and the bounded image queue. These tests use local or synthetic inputs and do not constitute an unrestricted penetration test of the hosting provider.
