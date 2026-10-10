# Validation — 10 October 2026

## Automated checks completed

- Prettier check passed for the active Next.js/TypeScript application.
- ESLint passed with the TypeScript recommended rules and React Hooks rules.
- Strict TypeScript `tsc --noEmit` passed.
- Seven Node tests passed: authentication/CSRF/logout; publishing/scheduling/reorder/conflicts/revisions/persistence; custom sections/input validation/contact inbox; uploads and embedded-asset import; crop geometry with source bounds and aspect-ratio checks; GitHub language aggregation/ranking; unavailable GitHub responses with cache reuse.
- `next build` completed with the public pages, private admin entry, API Route Handlers and protected upload handler.
- `npm audit` reported no known dependency vulnerabilities after removing an affected optional lint dependency chain.

The automated tests use isolated temporary SQLite databases. Existing authored data and the browser mock's localStorage are not reset.

## Actual browser checks completed

The production standalone build ran locally on port 3002 with `.qa-next-data`, separate from the owner's preview and database. Chrome was controlled through its local debugging protocol because the normal browser automation launcher failed with Windows error `0x80070020`.

- Signed in through the actual admin form using a temporary QA account.
- Created a draft; verified it was absent from the public API.
- Edited and published the post with a display time and a PNG selected through the actual file field, framed and uploaded as JPEG.
- Hid and showed the post; checked the public API after each mutation.
- Deleted the post, restored it from trash, and verified it returned as a draft.
- Reordered projects and verified the public order persisted.
- Created a custom section and a published entry; checked the saved public content.
- Saved appearance and layout settings and verified the server values.
- Sent a real contact message through the English public form and read it in the admin inbox.
- Switched the public interface to English and verified navigation and document language.
- Checked the language menu, project search and grid/list switch, section rename/hide, revision recovery through its dialog, and saved dark theme with a custom accent.
- Verified the editor focuses its first field and retains keyboard focus through 20 Tab presses.
- Verified Escape retains unsaved content, Continue editing returns focus to the field, and only explicit discard closes the editor and restores the opener's focus.
- No uncaught browser runtime exceptions were observed.
- Inline profile editing: saved identity, skills, a project and a custom published section entry; verified persistence after reload and logout. Empty sections remain editable in the private profile options menu, without placeholder cards or a large administration banner. Editing controls disappear after logout, and unauthenticated direct API writes are rejected. Checked the inline admin profile at all five widths and the editing dialog at 390 px.
- Image framing: checked pointer dragging, zoom, keyboard repositioning and cancellation. Verified pending framing blocks premature form saves and selected images stay private before saving. Decoded the actual exported JPEGs and checked dimensions and pixel colors against the chosen region: 800×800 avatar and 1600×400 cover. Verified guests can load the published cropped images. Captured avatar/cover framing screenshots at 390 px.

Responsive checks covered **360, 390, 768, 1024 and 1440 px**:

- Admin: profile/contact, projects, posts, sections and appearance/data.
- Public: profile, project list, project detail, activity, contact and search.
- No document-level horizontal overflow remained in these checks.
- Desktop/mobile screenshots were captured and visually reviewed for the profile and administration.

Issues found and fixed during browser verification: the mobile admin navigation's minimum width, reused form state when switching management pages, font asset paths after migration, and keyboard focus escaping a native dialog.

## Limits

- These are desktop Chrome viewport checks, not tests on physical phones or with a screen reader.
- No external production URL exists yet; hosting, domain/HTTPS and a persistent production disk have not been configured.
- Docker configuration is supplied. Docker execution was unavailable because the Docker Desktop Linux engine was not running.
- No email delivery, contribution/commit synchronization, OAuth, multi-region database or background notification service is claimed.
- Current language switching translates interface labels, not owner-authored content.

The older `QA.md` describes the historical mock. This document records the Next.js application's validation.

## Browser comment fixes verified

- Moved profile section management and appearance into the navbar Settings menu, replacing the clipped menu inside the profile card. Language switching is also in Settings.
- Checked administrator Settings bounds, square avatar bounds and centered image placement at 360, 390, 768, 1024 and 1440 px. Saved appearance through the new menu.
- Rechecked the owner’s original portrait avatar and the public Settings menu at 1063×704 and 390×704; captured and visually reviewed screenshots. The portrait is centered with cover fitting; both the main and navigation avatars retain their frames.
- Confirmed the sidebar shows GitHub technologies instead of language configuration. The main preview returned HTTP 200 and a complete cached response from 20 non-empty public repositories: Python, TypeScript, Java, C# and HTML. No private repository access or manually fabricated proficiency values are used.
- Re-ran the browser workflow including inline edits, image framing, public pages at five widths, language switching, keyboard dialogs and logout authorization checks; all passed with no uncaught exceptions.
