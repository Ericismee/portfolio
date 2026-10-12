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

The current CSP permits inline scripts for Next.js and the synchronous theme bootstrap. It provides defense in depth but is not a strict nonce-based script policy. Markdown and rich-content validation remain essential.

## Analytics boundaries

The public endpoint exposes aggregate visit counts, not visitor records. IP addresses and supplemental context are encrypted; country, browser, device, timestamp and page remain queryable analytics fields inside the private database. Stored visitor history has no automatic expiry.

Browser tracking records a visit only after its request reaches the application. Signed-in administrators and recognized bots are excluded; repeated views of one page in a 30-minute session are deduplicated. Blocked scripts, unavailable networks, failed tracking requests and pre-application firewall responses can create differences from edge-provider statistics.

DNS A/CNAME records and CDN addresses are public by design. A Vercel edge address does not disclose a private database endpoint, database password or a local computer's IP. DNSSEC and CAA require provider-compatible configuration; do not add or change them without checking the authoritative DNS and certificate setup.

## Validation

Run `npm run check`, `npm run build`, `npm audit` and `npm run security:source -- --history`. The source check screens tracked files and locally available Git history for private paths and recognizable credential formats; it does not detect every secret, image contents or sensitive prose. CI fetches full history before running it. Recheck anonymous access to private APIs and unpublished files after changing authentication, storage, routing or proxy settings. Audits are point-in-time checks, not a guarantee against all vulnerabilities.
