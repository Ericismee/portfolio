# Validation — 10 October 2026

## Automated checks completed

- Prettier check passed for the active Next.js/TypeScript application.
- ESLint passed with the TypeScript recommended rules and React Hooks rules.
- Strict TypeScript `tsc --noEmit` passed.
- Eleven Node tests passed: authentication/CSRF/logout; publishing/scheduling/reorder/conflicts/revisions/persistence; custom sections/input validation/contact inbox; uploads and embedded-asset import; crop geometry with source bounds and aspect-ratio checks; GitHub language aggregation/ranking; unavailable GitHub responses with cache reuse; paginated profile/repository import with fork exclusion from language totals.
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
- No email delivery, private GitHub synchronization, OAuth, multi-region database or background notification service is claimed.
- Current language switching translates interface labels, not owner-authored content.

The older `QA.md` describes the historical mock. This document records the Next.js application's validation.

## Browser comment fixes verified

- Moved profile section management and appearance into the navbar Settings menu, replacing the clipped menu inside the profile card. Language switching is also in Settings.
- Checked administrator Settings bounds, square avatar bounds and centered image placement at 360, 390, 768, 1024 and 1440 px. Saved appearance through the new menu.
- Rechecked the owner’s original portrait avatar and the public Settings menu at 1063×704 and 390×704; captured and visually reviewed screenshots. The portrait is centered with cover fitting; both the main and navigation avatars retain their frames.
- Confirmed the sidebar shows GitHub technologies instead of language configuration. The main preview returned HTTP 200 and a complete cached response from 20 non-empty public repositories: Python, TypeScript, Java, C# and HTML. No private repository access or manually fabricated proficiency values are used.
- Re-ran the browser workflow including inline edits, image framing, public pages at five widths, language switching, keyboard dialogs and logout authorization checks; all passed with no uncaught exceptions.

## Expanded GitHub integration verified

- The real public API returned Eric’s profile and 33 public repositories, including forks, with complete language aggregation from 20 non-empty repositories excluding forks. Actual counts at verification: 4 repository stars and 10 followers.
- Replaced percentage bars with compact technology chips, account identity, counts and an expandable searchable repository browser. GitHub data does not modify authored profile content.
- Checked the actual production build at 360, 390, 768, 1024, 1063 and 1440 px. At every width: no horizontal overflow before or after expanding; Enter opens the details; TypeScript search matches; an unmatched query shows an empty state; clearing search restores all 33 repositories.
- Verified English labels and no uncaught browser exceptions. Captured and visually reviewed desktop/mobile cards and expanded repository views. This targeted browser pass did not rerun unrelated administrator workflows.
- Fixed mobile’s inherited hidden-sidebar rule specifically for the GitHub card, keeping other sidebar cards hidden at widths up to 800 px.
- `npm run check` passed all eight tests, lint and strict types; production build passed.

## GitHub profile and activity page

- Replaced `/github`’s external-link placeholder with GitHub identity, all detected technology logos, repository/overview/activity tabs, calendar year selection and commit/event history.
- Real public sources returned 18 languages, 33 repositories, 30 recent owner-authored commits, 49 events and 420 contributions across 283 elapsed days of 2026 at verification. These are source snapshots, not guarantees of instantaneous updates or complete commit history.
- Browser checks at 360, 390, 768, 1024, 1063 and 1440 px passed: no page overflow, all technology logos loaded, day details worked, repository search/empty/clear states worked, all 33 repositories restored, and commit/event timelines displayed.
- Also checked the complete 365-day 2025 calendar, arrow-key day navigation, English labels, manual refresh, ten-to-eighteen technology expansion, and the actual automatic poll after waiting 62 seconds. No uncaught browser exceptions were observed.
- New automated tests verify exact contribution counts, leap years, fail-closed parsing, source fetch deduplication, authored commit filtering and stale data retention when upstream is unavailable. All eleven tests, strict types and lint passed; production build passed.
- Calendar HTML parsing is dependent on GitHub’s public markup. Invalid or incomplete markup is rejected, retaining a labelled old snapshot if available. GitHub’s API can delay or limit activity data; no second-by-second realtime claim is made.
- Local logo serving was checked in the standalone build. Docker’s public-directory copy was updated, but Docker execution was not repeated.

- Final targeted checks at 390 and 1063 px also verified tab alignment and repository filtering across the commit/event histories. Calendar and timeline screenshots were captured at their actual content positions and visually reviewed.
- Invalid and future calendar years returned HTTP 400; local Python/Jinja logo requests returned HTTP 200.


## Administrator GitHub curation — 10 October 2026

- Verified the actual administration form and inline dialog in an isolated database on port 3002; the owner's content on port 3001 was not modified.
- Selected manual featured repositories (NotebookE and LingoraAI), moved LingoraAI first, hid horune, saved and reloaded. Confirmed that the stored selections and the public featured order persisted.
- The public GitHub API returned 32 curated repositories, with no horune repository record or its owner-account commit/event records. Hidden selection names are omitted from the public settings projection. Existing portfolio projects are configured independently from GitHub repositories.
- Checked section toggles for calendar, technologies, commits and events, changed the interval to 15 minutes and restored 60 minutes. The related sections/tab disappeared and returned correctly.
- Checked the default one-hour interval in the form, rendered cadence and public configuration. **Did not wait an hour to verify an elapsed hourly poll in this pass.** The earlier 62-second poll test describes the previous default; it is not an hourly timing test.
- Checked public-account lookup, preventing a save before loading a changed account, clearing previous selections for a new account, Reset, repository search, and loaded empty-account state. Checked the unsaved-close warning and Continue editing/Reset behavior.
- Checked menu placement, administrator-only editing controls and their disappearance after logout. Guest access to the private lookup and unauthorized/CSRF-invalid configuration writes are covered by automated tests.
- Browser viewport checks on the GitHub page, inline configuration dialog and home profile at 360, 390, 768, 1024, 1063 and 1440 px found no document or dialog horizontal overflow. Visually inspected desktop/mobile screenshots and fixed vertically stacked checkboxes. Local logos and GitHub avatars loaded without broken images in the final page checks; checked keyboard focus in the dialog. No console errors were reported on the inspected preview tab.
- Fourteen automated tests passed, along with lint, strict types, formatting and the production build. New tests cover persistent settings, source filtering, case-insensitive names, fork exclusion, manual order/empty selection, disabled history and validated account lookup.
- These are desktop browser viewport checks. No physical-device, screen-reader, private GitHub/OAuth, background-worker or production deployment verification is claimed. GitHub source data can be delayed or stale; the app retains the existing source-status labels.


## Cover fade — 10 October 2026

Added a static alpha gradient to the profile cover image, blending its lower edge into the card background. The avatar and edit controls are outside the mask. The cover-only geometric backdrop and bottom border are removed when a photo is present; the empty-cover design remains unchanged.

Production build passed. In the running preview on port 3001, checked 360, 390, 768, 1024 and 1440 px: the image mask was active, the avatar had no mask and there was no document-level horizontal overflow. Visually reviewed desktop and 390 px screenshots. The background uses the card theme token; a dark-theme visual check was not performed in this pass.


## Link logos and profile jump navigation — 10 October 2026

- Added local inline SVG brand marks to social links, including canonical GitHub and LinkedIn labels. Other supported platforms have their corresponding marks and unknown link types use a globe.
- Renamed the profile contents card to “Đi đến nhanh”, added a short explanation and downward arrows, and moved it above the GitHub card. It is omitted when fewer than two sections exist.
- In the actual port-3001 preview, clicking Skills moved to section-3 and focused that section. Pressing Enter on Introduction moved to section-0 with its top at approximately 88 px, clear of the fixed header. Fixed inherited global navigation styling that initially arranged these links horizontally.
- Checked actual viewport widths 360, 390, 768, 1024 and 1440 px on the active profile tab: no document horizontal overflow. Visually reviewed the desktop link logos and vertical jump navigation. Lint, strict types and the production build passed.
- The requested TikTok avatar awaits the owner's TikTok URL or username. No account has been inferred from the reference image and the existing GitHub avatar remains in place.


## Cover height and sidebar order — 10 October 2026

- Extended the photo cover to 184 px on desktop/tablet and 128 px on mobile, preserving its fade and avatar overlap.
- Updated sidebar order to Links, GitHub, then Jump to a section.
- Production build passed. Checked actual preview widths 360, 390, 768, 1024 and 1440 px: expected cover heights and sidebar order, with no document horizontal overflow. Visually reviewed the final desktop screenshot.

## GitHub copy and local administrator login — 10 October 2026

- Shortened the GitHub heading to Dấu ấn mã nguồn and its description to Dự án và đóng góp trên GitHub. Updated the current stored settings through the versioned database writer, preserving the previous revision, as well as schema defaults.
- Configured the ignored local .env with PUBLIC_ORIGIN=http://localhost:3001. The startup script now stops with an actionable configuration message if the trusted origin is absent; origin checks, CSRF and secure production cookies remain intact.
- Submitted the existing filled login form in the actual port-3001 browser: login succeeded and the administration editor opened. Reloaded the GitHub page and verified its updated heading and description.
- Lint, TypeScript, all 15 tests and the production build passed. Added regression coverage for missing origin, rejection of a different origin and successful configured-origin production login with a Secure session cookie.
