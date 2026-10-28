# Verification results

Verified 2026-10-28. Environment: Linux ARM64, Node.js 22.23.2, npm 10.9.8, Python 3.12.3.

## Passed

- **Production build:** TypeScript strict checking, Vite compilation, and single-HTML packaging.
- **Packaging inspection:** one inline JavaScript module and inline CSS; no external script, stylesheet, image, font, or dynamic import dependencies. Both production HTML filenames contain the same bytes.
- **12 model/report tests:** full example JSON round trip; 0/1/20 findings render; long text and portrait image attributes render; React escapes imported HTML/script text; action data stays synchronized; delete/duplicate/reorder preserve invariants; invalid JSON, unsupported versions, duplicate IDs, broken action references, invalid priorities, invalid dates/colors/images, oversized files, and field limits are handled; unknown imported properties are discarded.
- **9 UI/packaging tests using jsdom:** five findings can be created, edited, reordered, duplicated, and deleted; action selections follow updates; project download content includes the full example and images; malformed/unsupported imports preserve current work; rejecting an unsaved replacement preserves work; valid imports restore data; print handoff invokes the print function; draft recovery and unavailable storage states render correctly.
- **Example asset inspection:** all five embedded original PNG mockups decode with Pillow and match their declared dimensions. This checks the actual saved example image data, not a browser image decoder.
- **Browser harness syntax:** `tests/browser_workflow.py` compiles successfully. The harness is supplied for real-browser acceptance testing on an unrestricted machine.

`npm test` reports three test files: 12 model/report cases, nine UI/packaging cases, and one Bash launcher case. Run individual suites with:

```bash
node --import tsx tests/model.test.tsx
node tests/workflow.test.mjs
node tests/launcher.test.mjs
```

The UI tests substitute download URLs and `window.print`, and use jsdom's DOM rather than a browser engine. They do not prove a real download, image resize, PDF export, page layout, or browser storage policy.

## Current typography and interface

- Bundled Sora variable (400–800) for controls and body text, and Instrument Serif Regular for headings and report titles. Both original WOFF2 files load through FreeType and produced a typography specimen that was inspected. This was a font specimen, not a browser screenshot.
- The packaging test compares both embedded WOFF2 byte streams with the source files. It also checks both copyright notices and full SIL Open Font Licenses in the standalone HTML. No CDN or font dependency remains outside the HTML.
- Replaced rounded form cards with section rules, lightened the navigation rail, simplified the monogram, and removed repeated decorative callouts. Fields remain 16 px, labels 13 px, and helper text 12 px.
- Kept native input labels, priority descriptions, 44 px action/icon controls, the compact finding selector, and keyboard reorder buttons.
- Current color-pair contrast: primary text 12.59:1, help text 5.34:1, sidebar text 6.20:1, selected navigation 9.33:1, primary button 13.87:1. Input outlines measure 3.29:1 against their background. These measurements cover these pairs, not a complete accessibility audit.
- Production build and all 22 automated cases pass. Project data and image round trips remain intact.
- The new fonts also apply to printed reports. They can change wrapping and page counts. Existing print sizes, margins, and image constraints remain in place; actual PDF pagination still needs browser verification.

## Guided workflow and Bash entry

- Fresh startup shows Create a report, Explore the example, and Open a saved project. No unchosen example is written as a user draft while the welcome screen is open.
- Tests cover Back/Next navigation, finding/action creation, backup download contents, PDF handoff, Exit guide, Restart guide, welcome-screen import errors and successful restore, cancellation of replacement, preserved recovered work, and zero-finding export with nonblocking reminders.
- All 22 automated cases pass: 12 model/report cases, nine UI/packaging cases, and one Bash launcher case. Help-dialog behavior uses a showModal substitute in jsdom; actual browser focus and modal behavior still need testing.
- Replaced the root HTML launch pages with start.sh; removed both ZIP archives. Build only emits dist HTML. The Bash launcher opens built output without Node, with optional dependency checks/build when output is missing or --build is requested.
- Launcher regression test simulates Linux, macOS, and Git Bash browser commands, paths containing spaces, execution from another directory, unknown arguments, and missing build/runtime errors. Simulations are not native OS/browser tests.
- No Windows, macOS, or Linux browser compatibility certification, real-user usability session, or actual PDF inspection was possible here. The supplied START HERE instructions and updated browser harness support those pending checks.

## Blocked, not passed

The initial small prototype built into a self-contained HTML file. Actual browser launch failed before a page could open. Both available Chromium and Chromium Headless Shell executables were attempted:

```text
setsockopt: Operation not permitted (1)
Check failed: . shutdown: Operation not permitted (1)
```

The execution sandbox denies the socket operations those browser processes require. No real browser page, browser screenshot, or PDF was produced. Further browser retries were stopped after the same restriction repeated.

Consequently, the following acceptance checks remain **unverified**:

| Acceptance check | Current evidence | Required remaining proof |
| --- | --- | --- |
| Open packaged HTML offline through `file://` | Inlined asset inspection; DOM execution under a simulated file URL | Open actual HTML with networking disabled in a real browser |
| Logo and multiple PNG/JPEG/WebP uploads | Resizing/encoding code and schema tests | Actual file picker, canvas resizing, proportions, errors, remove/replace behavior |
| Create five findings, reorder, and edit actions | Passing simulated UI workflow | Repeat with real keyboard, file picker, and browser |
| Save, close, reopen with all images | Exact JSON equality and embedded-image tests | Actual download, close browser/tab, import saved file, inspect decoded images |
| Malformed import does not lose work | Passing validator and simulated UI tests | Repeat using actual file selection |
| Zero, one, twenty findings | Passing report-render tests | Inspect browser screen/print pagination |
| Long text and portrait screenshots | Content/attribute tests; print flow rules in source | Inspect actual page flow and image proportions |
| Readable A4 and US Letter PDFs | Dedicated print stylesheet and selected `@page` size | Export actual PDFs, inspect every page for clipping, missing content, and blank pages |
| Supported desktop browsers | No actual browser launched | Test Chrome, Edge, Firefox, and Safari as needed; record OS and version |
| Keyboard access and mobile layout | Native controls, labels/descriptions, focus styles, skip link, reorder buttons | Actual focus traversal, zoom, narrow viewports, no horizontal page overflow |

No browser is claimed as certified. Chrome/Edge/Firefox/Safari remain intended test targets, not confirmed support results.

## Finish acceptance testing elsewhere

Run `npm run build`, then `python3 tests/browser_workflow.py` with Playwright and Pillow installed. The harness runs offline under `file://`, checks data preservation, and generates six actual PDFs: A4 and Letter for 0, 1, and 20 findings. The nonempty fixtures include long text and an actual portrait screenshot.

After the harness passes:

1. Open each PDF and inspect every page. Check all content is visible, images keep their proportions, application controls are absent, and there are no unnecessary blank pages.
2. Use the actual Export PDF button without replacing `window.print`. Check native print settings in each target browser. A4/Letter selection in the app and print dialog must match.
3. Repeat project save/open with a logo and all supported image formats. Compare the downloaded JSON and inspect screenshots after reopening.
4. Test keyboard access, focus visibility, 200% zoom, and 320/390/768/1024/1440 px layouts on every editor section and Preview.
5. Test private browsing and blocked/full storage. Download a project even when local recovery is unavailable.
6. Record the browser and OS versions and any PDF differences. `pdfinfo`, `pdftotext -layout`, and rendered PDF page images can help inspect paper dimensions, text completeness, and clipping.

## Known limits

- One active project and one best-effort local draft; downloaded JSON is the reliable backup.
- Browser download permissions, file-origin storage, and printing vary by browser and OS.
- Images are resized/re-encoded, which may reduce fine evidence detail. Preserve original files separately.
- No PDF-to-project import, automated crawling, scoring, AI, accounts, cloud storage, or collaboration.
- PDF pagination and visual quality cannot be confirmed from the tests available here.
