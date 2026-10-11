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

## Image framing grid and taller cover — 10 October 2026

- Added a non-interactive 3×3 framing grid. Initial/reset zoom is 1.1× so an already cropped image has repositioning room along both axes; no blank edges are allowed. Added lost-pointer-capture cleanup and clearer zoom guidance.
- Increased the photo cover to 216 px on desktop/tablet and 152 px on mobile, retaining its fade and avatar overlap.
- In the actual port-3001 editor, dragged the existing cover by 20 px horizontally and 5 px vertically. Preview offsets changed from (-26, -6.5) to (-6, -1.5), confirming pointer movement. ArrowRight changed the offset again; Reset restored initial offsets. Visually reviewed the grid. Canceled without applying/uploading or saving the test crop.
- Checked the open framing editor at 360, 390, 768, 1024 and 1440 px: no document horizontal overflow; frame stayed within the viewport and cover heights were as expected. Physical touch-device behavior and crop export were not retested in this pass.
- Lint, TypeScript, all 15 existing tests and production build passed.

## Compact GitHub page and complete repository configuration — 10 October 2026

- Removed the large GitHub introduction card; kept manual refresh and owner configuration in a compact toolbar beside the tabs. Automatic refresh logic remains unchanged and connection failures still show a notice.
- Removed the normal Synced label from the profile sidebar while retaining incomplete/unavailable source labels.
- Repository configuration uses the editor's single scrolling area instead of a nested list scrollbar. Repository names and visibility/featured controls wrap as needed.
- Verified 33 loaded repositories in isolated port-3002 administration and inline configuration, including visibility/featured controls, at 360, 390, 768, 1024 and 1440 px: no list horizontal overflow or clipped option groups. No test settings were saved. Visually reviewed the inline list.
- Verified the actual port-3001 GitHub page at the same widths: old heading absent, compact refresh present, no document horizontal overflow. Clicked Refresh and switched to Repositories successfully; visually reviewed the final page. The home sidebar's normal Synced label was absent.
- Lint and the production build, including TypeScript compilation, passed.

## Roomier administration and image controls — 10 October 2026

- Added section jump links to GitHub configuration, moved repository selection before visibility toggles, and removed obsolete title/description inputs after the public introduction card was removed. Existing stored copy remains preserved.
- Expanded image framing to available editor width, enlarged the existing cover preview, styled the administration image workspace, and added horizontal/vertical position sliders and a 1× zoom button. Clarified that restoring previously cropped areas requires the original image.
- In isolated port-3002 administration, clicking Choose repositories placed its fieldset at approximately 100 px below the top, clear of the header. All 33 repositories loaded. At 360, 390, 768, 1024 and 1440 px, the repository list and document had no horizontal overflow.
- Tested the cover position sliders with End/Home: horizontal 100%, vertical 0% changed preview offsets accordingly. Zoom out returned 1×; Reset returned centered 1.1×. Visually reviewed the enlarged desktop workspace. Checked the framing editor at the same five widths without document overflow. Canceled without applying or saving a crop. Owner content was not changed.
- Lint and production build, including TypeScript compilation, passed. No physical-device touch or export test was performed for this UI-only adjustment.

## Featured repository entry point and clearer portfolio sections — 10 October 2026

- Added an administrator-only Choose featured repos action beside the GitHub featured list. It opens configuration focused/scrolled to repository selection; manual selections and ordering use the existing authenticated persistence flow.
- The home GitHub account card now links internally to /github. External GitHub links remain available elsewhere.
- Clarified default home headings as Selected work and All projects, preserving custom section-title overrides. Selected work has a short explanation; All projects now lists all three current projects with descriptions rather than excluding featured entries.
- In isolated port-3002 browser QA, opened the new action, selected portfolio, saved, verified its featured card and reloaded. Then removed portfolio and saved to restore the previous QA selection. Owner selections were not altered.
- Clicked the actual port-3001 account card and confirmed /github. Verified home headings and three project summary descriptions; checked 360, 390, 768, 1024 and 1440 px without document horizontal overflow. Visually reviewed the project list and checked the owner featured action at 390 px without overflow.
- Lint, TypeScript, all 15 tests and the production build passed.

## Original uploads, website logo and appearance save — 10 October 2026

- Added a separate website logo upload in Appearance & data. Existing profiles default to the initial letter. Uploaded logos use contain sizing in the header to preserve proportions.
- New image selections upload the original bytes immediately, retaining dimensions, transparency and GIF animation. Cropping is explicitly optional; the crop starts at 1× and exports a PNG at source crop dimensions without upscaling. Applying a crop still requires Save to publish.
- Fixed HTTP error recognition across reloaded modules so stale saves remain 409 conflicts instead of becoming generic 500 errors. API/schema caches refresh with module generations while sharing the SQLite connection without closing active handlers. Unexpected server failures now retain stack diagnostics in server logs.
- In isolated port-3002 administration, uploaded an existing 236×419 JPEG as a logo; confirmed the original dimensions, saved successfully and visually reviewed the logo on a project page in its 38×38 header box with contain sizing. Returned to administration and saved again after visiting the public page. Opened optional framing, moved the position with ArrowDown, applied it, and confirmed a 236×236 PNG before saving successfully.
- Added regression checks for original byte preservation, logo/appearance persistence, stale conflicts across constructor generations and reuse of a live database connection. Lint, TypeScript, all 16 tests and the production build passed. The final API suite also passed after the shared-connection assertion was added.
- Restarted the port-3001 development server and confirmed the new logo upload is available in owner administration. Owner content was not modified by the tests. Touch-device behavior and animated GIF cropping were not exercised in this pass.

## Administration usability and feature audit — 10 October 2026

- Expanded Skills to at least 12 rows with readable spacing and manual resizing. Added clear active navigation, section icons, roomier administration cards, top Save changes buttons and a Save action in long editor footers. Desktop navigation is fixed; narrow screens use a sticky horizontal navigation bar.
- Fixed native date inputs saving a stale React value: submission now reads the displayed form controls. Reproduced the failure, then saved a post for 1 January 2099 through the browser and confirmed its persisted date, Scheduled label/filter and absence from public content.
- Unified publication status between administration, inline editing and public filtering. Scheduled posts no longer appear under Published. An explicitly published project is no longer accidentally excluded because its separate descriptive status says Bản nháp; legacy imports still migrate old draft data correctly.
- Save conflicts and expired/invalid authentication now expose the dashboard Reload data action. In two separate browser windows, a stale save returned a conflict without overwriting the newer version; Reload data restored the current server data.
- Browser QA used the isolated port-3002 database: Skills trimming/deduplication and top save; project create/draft/publish/reorder/hide/trash/restore; post scheduling and filters; custom section and published entry; contact submission arriving in Inbox; manual featured-repository ordering and persistence on the public GitHub page; appearance save, revision restore and JSON export. No owner content was changed.
- Checked the administration GitHub repository list at 360, 390, 768, 1024 and 1543 px: no document/list horizontal overflow. Desktop navigation stayed at 108 px while the document scrolled to 2908 px. Visually reviewed desktop and mobile Skills with the full list visible. No captured administration console errors.
- Expanded automated regression coverage for publication boundaries, non-mutating public filtering, legacy backup round trips, failed imports/restores, 30-version retention, expired sessions, original GIF/PDF byte preservation and oversized file rejection. Lint, strict types, all 20 TypeScript tests, the legacy server test and production build passed.
- Automated and browser checks cover the listed core flows; physical touch devices, every possible input combination and a full real-time GitHub refresh interval were not exercised. Existing GitHub fixture tests cover caching, filtering and upstream failure behavior.

## Activity authoring, project images and contact navigation — 10 October 2026

- Added Tiptap visual authoring in both inline and advanced administration: bold/italic/underline with Ctrl+B/I/U, headings, lists, quotes, links, undo/redo, uploaded or URL images and YouTube embeds. Existing plain posts convert into editable paragraphs without losing text. Rich documents persist separately from their searchable plain-text projection.
- Public rich content renders through a React node allowlist, never raw HTML. Media URLs reject script/data/credential URLs; YouTube embeds normalize to the exact privacy-enhanced host. Malformed or deeply nested documents fall back to plain text. CSP permits that embed host specifically.
- Made Write/Edit/Delete explicit in Activity. Delete moves a post to the recoverable administration trash. Clarified the sidebar as About the author with an avatar and an explanation of its profile/source links.
- Project artwork defaults to a square contain frame; owners can select square, landscape, portrait or original aspect ratio in either editor. The choice is used on project cards and detail pages without changing uploaded bytes. Clarified the Projects heading/actions and introductory copy.
- Moved direct contact channels into the contact sidebar so the form starts immediately below the introduction. Email channel links open Gmail compose. Consolidated settings into the header avatar and added a visitor light/dark preference that survives reload without modifying the owner's saved appearance.
- Browser QA on isolated port 3002 verified Ctrl+B/I/U markup, saving/reopening rich content, an image uploaded within the body, normalized video frames, selected text retained when inserting media, editing and soft-deleting a post, and a saved landscape project frame with contain sizing (351×196 px). Captured no browser errors after allowing the embed source. Video playback itself and physical touch were not exercised.
- Checked Contact and Projects at 360, 390, 768, 1024 and 1543 px without document horizontal overflow. Checked the editor at 390 px without toolbar overflow and visually reviewed it. Verified the avatar menu toggles light/dark and retains the choice after reload. Read-only checks on port 3001 confirmed the new contact layout, Gmail destination and uncropped project artwork. Owner content was not changed.
- Lint, strict TypeScript, all 22 tests and production build passed. New tests cover document/plain-text round trips, old content compatibility, frame defaults/options, malformed/deep documents and rejected unsafe media/embed URLs. Tiptap integration follows its official Next.js/React documentation with deferred client initialization.

## Concurrent GitHub saves and contact/project refinements — 10 October 2026

- GitHub saves now read the latest content and merge only edited settings; per-repository visibility changes merge independently. Other profile sections remain intact. Conflicting edits to the same setting retain the local form and offer an explicit action to apply the owner's choices on the current version. Account switches keep their settings together, and version/CSRF checks remain enforced.
- Browser QA in two isolated port-3002 windows verified independent settings survive stale saves, same-setting edits show a conflict without losing the form, and the explicit resolution saves successfully while preserving unrelated changes.
- Removed the contact message's 10-character minimum and 10,000-character maximum, retaining the nonempty requirement and the general request byte envelope. Added six localized subject suggestions with custom input. Automated checks accepted a two-character message and a message longer than 10,000 characters, rejected whitespace, and verified persisted messages. Browser submission of the short message succeeded.
- Moved the project back link above artwork and compacted the Projects heading/actions. New project uploads select the original aspect ratio automatically. Both editors offer an option to omit artwork from cards and detail pages. Existing explicit frame choices are preserved.
- Browser QA verified upload resets the frame to Original, the rendered frame matches the source ratio, and saving No image omits artwork from both list and detail while retaining the detail link. Read-only owner-port checks confirmed the contact controls and top back link. Owner content was not modified.
- Lint, strict types, all 25 automated tests and production build passed. The checks cover these reported flows; they do not claim every possible input or device combination.

## Aligned project cards and wider editors — 10 October 2026

- Project cards now use one 16:10 contain frame, preserving the full uploaded image inside equally sized artwork areas. Detail-page frame preferences and the hide-image option remain available. Grid rows share a height, title flex growth was removed, descriptions reserve consistent space, technologies render as individual chips, and status/detail actions align at the bottom.
- Expanded inline editing dialogs from 720 to 1080 px maximum. Desktop forms place short fields in two columns, with names, titles, descriptions and media spanning the width. Header/footer remain fixed within the dialog, and mobile retains one column with narrower padding.
- Read-only browser QA on port 3001 measured matching image/title/description/footer positions for adjacent project cards, equal featured cards on the profile, equal list cards with no horizontal overflow, and all three mobile cards at the same height. The dialog measured 1078 px at a 1280 px viewport and 366 px at 390 px, without horizontal overflow. Visually reviewed desktop and mobile dialogs. No content was saved or changed in the owner's database.
- Lint, strict types, all 25 tests and production build passed. This change is presentation-only; no new implementation-mirroring tests were added.

## EriHub-inspired project cards — 10 October 2026

- Read EriHub's src/components/product-card.tsx as the user-requested design reference, without modifying that repository. Applied its rounded outer card, inset bordered 16:10 thumbnail frame, padded contain image, category/name hierarchy, bottom divider and circular arrow action to portfolio projects and featured cards. Retained descriptions, technology chips, status, administration controls and detail links.
- Read-only browser review confirmed full images inside the new frame and equal card heights. Desktop list cards measured 286 px; mobile grid cards measured 512 px with equal 179 px artwork areas and no document horizontal overflow at 390 px. Mobile heading actions now sit below the single-line title. Temporary viewport and tabs were cleaned up; owner data was not changed.
- Lint, strict types, all 25 automated tests and production build passed. The final CSS-only mobile heading adjustment was followed by another successful build and browser geometry check.

## Fill project forms from GitHub — 10 October 2026

- Added a GitHub repository picker to project creation/editing in both inline and advanced administration. Owners load the configured account's public repositories, search/select one, read a preview, then apply it to the editable form. Applying fills empty fields by default; replacing existing authored fields requires the explicit checkbox. Enter in repository search does not submit the project form. Import does not publish or save automatically.
- The authenticated detail endpoint reads repository metadata, language byte rankings, README and root package.json from fixed GitHub API URLs. It extracts declared frameworks from dependencies and a bounded Built With/Tech Stack section. Repository description falls back to an introductory README paragraph. Homepage is used for Demo only when it passes URL validation. README source remains linked and a bounded plain-text excerpt is editable as Details. Role only indicates personal repository/fork ownership, never inferred personal contributions or achievements.
- Only public metadata is accepted, even when a server token exists. Requests have a shared deadline, bounded responses and a bounded short-lived cache; optional files can be missing without preventing basic import. Input paths reject traversal, API-supplied URLs are not fetched, and README is rendered as text. Implementation follows GitHub's repository and contents REST documentation: https://docs.github.com/en/rest/repos/repos and https://docs.github.com/en/rest/repos/contents.
- Isolated port-3002 browser QA loaded the real NotebookE repository, previewed it, applied it while preserving a manually entered name, saved a draft and reopened it in advanced administration with imported GitHub/role fields intact. Owner-port read-only mobile QA at 390 px confirmed fallback description and README-declared technologies and no dialog/picker horizontal overflow. No owner content was saved or changed.
- Lint, strict types, all 28 tests and production build passed. New regressions cover public metadata/framework extraction, README description fallback, missing optional files, private repository rejection, safe demo links, invalid paths, cache reuse and preservation of authored fields/publication/identity. API checks require authentication and reject invalid import queries.

## CV, activity discovery and Markdown content — 11 October 2026

- CV uploads now validate PDF signatures, size and missing MIME on the client, preserve the original filename, and explain interrupted connections while retaining the form. PDF.js renders the uploaded CV directly, with page navigation, zoom, open-tab and download actions. File serving retains access checks; preview responses use inline disposition and downloads use attachment disposition. The original reported network failure could not be reproduced; a valid PDF upload, save, reopen, public preview and download succeeded in isolated browser QA. The downloaded file's SHA-256 matched the original exactly. PDF upload remains limited to 2 MiB.
- Activity content always renders the authored rich format. A ResizeObserver enables Read more only for content exceeding the 320 px collapsed height; browser QA retained bold text when collapsed and expanded the test post from 320 to 512 px. Filters include category counts and detect embedded media/links. Search now covers public project details, roles, technologies, rich/Markdown posts, custom sections, profile, channels and CV, with accent-insensitive multi-word matching and publication filtering. Browser QA found a post with an unaccented multi-word query. Featured cards measured equal heights with 12 px outer corners; social links expose their actual address in a tooltip and title.
- GitHub README imports retain Markdown rather than stripping headings, links, images and code. GFM rendering supports tables, task lists, emphasis, fenced code and lists. Relative README URLs resolve against the imported repository path; image blob URLs resolve to raw assets. Raw HTML is skipped and unsafe URL schemes are rejected. Legacy GitHub excerpts use format detection; already removed README content cannot be recovered without importing it again. Project details can explicitly retain manual plain text or render Markdown.
- Both inline and advanced post editors now offer the GitHub repository picker. Import fills empty title/link/content fields, preserves authored content by default, and only replaces existing content when explicitly selected. Imported posts retain Markdown and source base, with a Markdown editor/preview; manual posts retain the visual rich editor. Import does not save or publish automatically. Browser QA verified Markdown save, detail rendering and edit/reopen, and project Markdown tables/code after save. Real GitHub repository listing succeeded, but the detail fetch was blocked by GitHub's exhausted unauthenticated rate limit (403, remaining 0). Mocked API tests cover README extraction and preservation; the UI now reports rate exhaustion explicitly.
- All mutations during browser QA used the isolated port-3002 database. Owner content was not saved or modified. Final lint, strict types, 35 automated tests and production build passed.
- Library references: https://mozilla.github.io/pdf.js/examples/ and https://github.com/remarkjs/react-markdown and https://github.com/remarkjs/remark-gfm.

## Compact post actions — 11 October 2026

- Renamed the appearance menu action to “Giao diện sáng / tối” with a consistent SVG moon icon. Edit and delete now use explicit pencil/trash icons in the post author row, aligned to the right, with accessible names and hover titles. The footer retains only a compact share action with its own icon. Mobile controls retain 40 px targets.
- Read-only owner-port browser QA confirmed the appearance label, edit/delete alignment at the right edge of both posts, and 32 px-high share buttons. The edit icon opened the correct existing post form; it was closed without saving. Owner content was not modified. Lint, strict types and production build passed; no new tests were needed for this presentation change.

## Admin GitHub account connection — 11 October 2026

- Added a persistent admin account connection through a GitHub personal access token, available in advanced GitHub settings and both repository import pickers. Credentials are validated through GitHub `/user` before replacement; no OAuth application or actual owner credentials were configured during this task. Connection is shared by profile admins and requires the owner to enter a token in the UI.
- Credentials are encrypted with AES-256-GCM in a separate SQLite table and a local key file; no credential appears in content, revisions, content export or API responses. Connection mutations require authenticated admin, trusted origin and CSRF. Environment token remains a documented fallback after disconnect.
- Authenticated import lists authorized owned/collaborator/organization repositories, including private ones, with owner-qualified names. Details permit private metadata only on the authenticated admin path and show a private-content warning. Import still requires explicit apply/save; public GitHub feeds continue filtering private repositories. Ownership labels are suppressed when the connected account is not the repository owner.
- Repository lists deduplicate for five minutes; details cache keys include credentials and private-access mode. Public stats use the connected credential with public-data filtering, bypass previous anonymous error caches, and stop language batching when rate limited. Cache separation prevents a disconnected user from reusing private detail cache entries.
- Isolated port-3002 browser QA confirmed the connection panel in advanced administration and the Activity editor, masked token input, disabled empty submission and retention of an authored title while opening connection. No real token was entered and no owner content was changed. The authenticated/private upstream path was exercised using mocked GitHub responses.
- Production build passed. Final lint, strict types and 36 automated tests passed, including credential encryption, admin/CSRF enforcement, private repository import, public-content exclusion, cached account listing, invalid-token replacement preservation and disconnect.

## Repository visibility and Activity editing — 11 October 2026

- Verified the owner's actual stored GitHub connection without exposing credentials or repository contents: 65 authorized repositories were returned (36 public, 29 private), without pagination truncation. A private repository detail read returned a complete Markdown README, technology fields and repository link. No imported owner content was saved or published during verification.
- Import pickers now provide All/Public/Private filters with counts, visibility-labelled options and Public/Private option groups. Repository previews label their visibility and render README using the same safe GFM renderer as saved content.
- Markdown authoring defaults to side-by-side source and live formatted preview, with Write, Preview and Split controls. Small screens stack the panes. Switching preview mode retains the named Markdown form value. Raw HTML remains disabled and unsafe links remain rejected.
- Activity feeds sort by display/creation timestamp descending without mutating stored order. Authenticated admins can switch among published, draft, scheduled and hidden posts on `/activity`; type counts follow the selected publication state. Private entries are obtained only from the authenticated content endpoint, have explicit admin-only labels, open their editor from the title, and omit sharing controls. Public projections remain unchanged.
- Author headers include hours/minutes and date (UTC+7), compact publication metadata and right-aligned edit/delete controls. Time formatting uses an explicit zone to avoid server/client timezone hydration mismatches.
- Isolated port-3002 browser QA verified newest-first order, formatted Markdown headings/emphasis/lists/tables/code, saving a draft, selecting the Drafts tab, rendering the draft and reopening its editor with content intact. Owner content was not modified. Production build, lint, strict types and 37 automated tests passed; the new regression covers timestamp ordering, draft/hidden/scheduled separation, type filtering and non-mutating sorting.

## Remembered GitHub credentials and Windows key protection — 11 October 2026

- Retained server-side persistent AES-256-GCM token storage and added Windows DPAPI CurrentUser protection for the encryption key. New Windows keys are protected before writing; existing raw keys migrate atomically without changing the underlying key. Legacy ciphertext migrates to a versioned format binding the connected login as authenticated data. Missing/corrupt keys fail closed rather than silently regenerating.
- The fixed PowerShell DPAPI helper receives key bytes through stdin only, hides its window, has a timeout and never includes secrets in arguments, environment variables, plaintext temporary files or application logs. Non-Windows deployments retain restrictive key-file permissions and have their different protection model documented.
- The owner's existing connection was migrated under the same Windows account. Verified the DPAPI-wrapped key, versioned ciphertext and successful GitHub account validation without outputting token/key bytes. Repeated account validation in a fresh process succeeded; no token re-entry or owner content changes were needed.
- The connection panel explicitly reports remembered storage and hides its empty password input behind “Thay token” after connecting. Expiry/revocation still requires replacement; the token is never returned to the browser.
- Lint, strict types, all 39 automated tests and the production build passed. New regression tests exercise a fresh process, legacy migration, authenticated-login and ciphertext tampering, corrupt keys, missing-key preservation and absence of plaintext credentials in stored ciphertext.

## Clear author metadata and guest preview — 11 October 2026

- Enlarged author names, separated metadata with more spacing, and added clock icons and distinct publication badges with icons. Uses existing theme colors and wrapping layouts for narrow screens; date/time still use explicit UTC+7.
- Added “Xem như khách” for authenticated admins in the avatar menu, with a visible preview indicator and return action both in the menu and above the page. Preview is a tab-scoped sessionStorage preference and never changes authentication cookies or calls logout. Public content remains projected through `publicContent`; editing buttons, private post lists, publication-state tabs and administration settings/dialogs are suppressed in preview.
- Isolated port-3002 browser QA verified switching directly from a draft feed to public posts, absence of draft content and edit controls, persistence after reload and loading another route, and return to editing without signing in again. Verified desktop and 390 px layouts, restored the viewport, and closed the test tab/server. No owner content or sessions were changed.
- Production build, lint, strict types and all 39 automated tests passed. Browser QA covers the UI preference and existing automated publication tests cover public filtering and private-content exclusions.

## Social link tooltip clipping — 11 October 2026

- Social-link cards allow tooltip overflow and rise above adjacent content while a link is hovered or keyboard-focused. Active links rise above sibling rows. Tooltip width is bounded by the link row with long addresses wrapping inside the sidebar, avoiding spill into the cover column.
- Read-only owner-page browser QA confirmed the full LinkedIn URL is visible, its width equals the row width, and its card has visible overflow with the intended stacking layer. Checked the last Facebook row tooltip extending beyond its card above the following GitHub card. Saved a screenshot and closed the temporary tab without changing owner content. Formatting and production build passed; no new automated tests were needed for this CSS-only correction.

## Facebook-style authors and searchable repository list — 11 October 2026

- Post headers now pair a 44 px avatar with a linked author name and a quiet secondary line: a natural-language date/time, separator and accessible public globe. Current-year dates omit the year for compact mobile layout; full timestamp and UTC+7 remain in the tooltip. Private publication states retain explicit admin-only labels.
- Replaced the native repository dropdown with a bounded scrollable list of native radio choices. Each row separates repository name from owner/language/fork metadata and shows a public globe or private lock label. Selection is highlighted and repeated beside the read action. The list supports keyboard arrow selection, empty results, disabled loading states and the existing public/private filters.
- Search combines whitespace-separated terms across name/owner, technology and available description/topics, ignores accents/case, sorts matching name prefixes first and does not mutate the source list. Selected repositories are retained in the explicit selection summary, not inserted into unrelated search results. Reloading the source list resets stale selection/preview.
- Read-only owner browser QA loaded all 65 repositories, found NotebookE by name, found nine TypeScript matches and three private TypeScript matches with correct private labels, verified empty results and preserved selection, changed choices with ArrowDown, and successfully read NotebookE metadata/README. The form was closed without applying or saving imported fields. Verified 390 px and desktop layouts for the picker and author header, saved screenshots, reset viewport and closed temporary tabs.
- Lint, strict types, all 40 automated tests and the production build passed. New search regression covers combined terms, accent normalization, visibility, empty results, sorting and source-order preservation.


## Private-state styling, bilingual UI, 20 MB uploads and leakage regression — 11 October 2026

- Applied a shared amber private-state palette to repository choices, selected private repositories, import previews, unpublished activity, admin content rows and hidden section/edit lists. Dark mode uses separate contrast-aware colors; public items retain the existing theme.
- English is the initial HTML and interface language. Explicit Vietnamese/English preferences survive reload; unavailable browser storage does not prevent switching. Built-in section/status labels and error messages follow the selected language while custom titles, authored posts and imported README text retain their source language.
- Raised image/PDF limits to 20 MiB on the client, streamed API request and storage validation, with matching guidance. JSON file imports accept 20 MiB plus a small server-side envelope allowance. Exact 20 MiB PDF/GIF requests pass and one additional byte returns HTTP 413. Signatures, MIME validation, authentication, origin and CSRF checks remain enforced.
- Fixed public projection leaking hidden section names/display titles/configuration. Public output removes those sections and their metadata, as well as draft/hidden/scheduled/deleted entries, without modifying saved owner content. Extracted the upload response handler for regression coverage; published Markdown/rich-document upload references now work, while unpublished files require an active administrator session.
- Added tests for every private read endpoint against anonymous/forged sessions, absence of confidential markers in public JSON, upload publication/revocation/logout/traversal, upload boundaries and language helpers. All 45 automated tests, lint, strict types and the production build passed. Existing tests also cover encrypted credentials, tampering/missing keys, private GitHub imports, XSS and unsafe rich/Markdown URLs.
- Isolated production preview on port 3002 verified public HTML (including embedded server props) and JSON for profile/projects/activity/contact/GitHub/search contain no private fixture markers, private post details return 404, and live 20 MiB/20 MiB+1 uploads return 201/413. Browser QA verified English initial UI, Vietnamese translation and persistence after reload, and different private-state colors in light/dark modes. No owner content, connection or sessions were changed. Temporary tabs and preview server were closed.
- These checks cover the tested paths and are not a guarantee against every possible vulnerability.
