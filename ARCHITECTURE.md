# Architecture and code conventions

The application uses Next.js App Router, React, strict TypeScript, Zod and the Node.js SQLite driver. The application requires Node.js 24.

## Request flow

1. A public Next.js page reads the saved content through `lib/database.ts`.
2. `publicContent` removes drafts, hidden entries and future scheduled posts **before** content reaches React or the browser.
3. The public React components render that filtered document. Navigation uses real URLs; the former hash links redirect to their corresponding pages.
4. The admin loads its private content through authenticated API requests. Its session cookie is HttpOnly, and every mutation also checks the origin and a CSRF token.
5. Zod validates the submitted document. SQLite saves it in a transaction, incrementing its version and retaining the previous document for recovery.

## Responsibilities

- `app/`: pages, route handlers, metadata and global styles. API routes run on Node.js, not Edge.
- `components/profile-site.tsx`: public profile, project and post presentation.
- `components/admin.tsx`: management workflows and persisted mutations.
- `components/admin-form.tsx`: reusable labeled forms, asset upload, saving/error states and accessible native dialogs.
- `components/language.tsx`: Vietnamese/English interface context. Owner-authored content is not automatically translated.
- `lib/schema.ts`: runtime validation and the corresponding TypeScript types. Do not create a second incompatible content model.
- `lib/database.ts`: initialization, transactions, optimistic concurrency and 30 recovery revisions.
- `lib/api.ts`: HTTP methods, authorization, validation, contact inbox and rate limits.
- `lib/auth.ts`: password hashing, session tokens and cookies.
- `lib/uploads.ts`: file signature checks, size limits and migration of embedded mock assets.
- `lib/client.ts`: typed requests and explicit import of legacy browser data.
- `lib/theme.ts`: accent and readable foreground colors.
- `lib/seed.ts`: initial content only. An existing database is never overwritten at startup.
- `tests/api.test.ts`: isolated authorization and content lifecycle tests.

## Editing conventions

Use descriptive names, two-space indentation and the checked-in Prettier configuration. Run `npm run format` after editing. Keep TypeScript strict; avoid `any`, ignored compiler errors and disabled validation. Add comments for the **reason** behind an implementation choice, especially data preservation, session security and deployment storage. Do not narrate obvious JSX or repeat what a variable name already says.

Add a new editable field to its Zod schema first, then to the admin form and public presentation. Keep user-provided text as normal React text nodes. Never render it with `dangerouslySetInnerHTML`.

## Persistence and deployment

The first schema version uses `CREATE TABLE IF NOT EXISTS` and a migrations table. It is compatible with the SQLite database created by the earlier Node server. Content is validated on read and write. Future schema changes must use a numbered, transactional migration and retain a backup.

`DATA_DIR` contains the database, WAL files and uploaded assets. It must remain outside `.next` and survive deployments. The standalone startup script resolves its absolute path before Next.js changes its working directory. Docker uses a named persistent volume.

This is a single-instance personal website. SQLite and in-memory rate limits are not a multi-region or horizontally scaled deployment design. A serverless deployment with ephemeral storage requires a separate durable database and object-storage adapter; copying this build to static hosting does not provide working administration.

Uploaded drafts are accessible only to an authenticated administrator. An anonymous request may fetch an uploaded asset only when the public document references it. A previously public asset cannot be made unknown to people who already downloaded it.

The contact form stores messages in the admin inbox. It does not send email or run background notification jobs. Scheduled posts are filtered at request time; no cron service is needed.
