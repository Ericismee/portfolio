# Backup and recovery

Production runs an authenticated Vercel cron at **20:00 UTC (03:00 UTC+07)** daily. Configure server-only `CRON_SECRET` and a separate `BACKUP_ENCRYPTION_KEY` (32 cryptographically random bytes, hex encoded). Deployment alone does not confirm a successful backup: check cron invocation logs and the private `backups/snapshots/` prefix.

Snapshots use a consistent, read-only PostgreSQL transaction. They include content, revisions, accounts/password hashes, MFA, inbox, GitHub credentials and complete visitor history. Sessions and temporary rate limits/upload intents are excluded. Database snapshots are gzip-compressed and authenticated with AES-256-GCM. The credential encryption key is included **inside** the encrypted snapshot. Losing the separate backup key makes recovery impossible.

Uploaded files are copied once into private `backups/assets/`; immutable names let later snapshots reuse them. Publication checks never expose backup paths. Snapshots and asset copies are retained until an operator explicitly removes them. Monitor storage growth. A snapshot fails visibly above one million rows per table or 100 MiB of JSON rather than silently omitting records; larger installations require a streaming database backup service.

## Verify a production backup

From the linked project, with Node.js 24 and development dependencies installed:

```sh
npx vercel env run -e production -- node scripts/backup-cloud.ts --verify
```

This creates a snapshot, downloads and authenticates it, restores all tables into an **isolated in-memory PostgreSQL-compatible database**, compares row counts and reads every copied file. It never restores over production. Logs contain only sizes/counts and a backup path, never secret values or visitor records.

Vercel variables stored as **Secret** cannot be pulled by `env run`. The direct command therefore needs the credential and backup keys supplied securely through your own environment. A local recovery copy of this installation's backup key is Windows DPAPI-protected under `.data/backup-recovery/`; it is excluded from Git and tied to the Windows account. Move an independent recovery copy into a password manager before relying on this machine as the only recovery source.

When a matching scheduler key has also been stored under `.data/cron-recovery/`, append `--remote` to run the authenticated production backup endpoint and verify the downloaded snapshot locally. This avoids pulling the application's credential encryption key; that key stays inside the authenticated encrypted archive. Do not rotate scheduler credentials without authorization.

## Recovery procedure

1. Export the encrypted snapshot and its listed asset copies from private Blob. Keep a second copy with an independent provider or offline; same-account copies do not protect against losing the entire cloud account.
2. Store `BACKUP_ENCRYPTION_KEY` in a password manager separately from the archive. Also keep access to Vercel and database-provider accounts with recovery codes.
3. Provision an **empty** database with the application schema, then authenticate/decrypt using `decryptBackup` and restore with `restoreBackup` from `lib/backup.ts` inside a transaction. The helper refuses nonempty tables. Rebuild serial sequences for messages/revisions (`setval` to their maximum IDs) before enabling writes.
4. Copy archived assets back to `uploads/` with private access. Restore `GITHUB_CREDENTIAL_KEY` from the authenticated snapshot into server-only configuration. Rebuild analytics rollups from restored raw history, create fresh sessions and verify private/published boundaries before assigning the domain.

There is intentionally no public restore endpoint. Test recovery against a disposable target first. Monitor failed cron runs; backup storage is subject to the provider's quota and charges.
