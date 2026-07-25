# Step Recorder — Desktop

An Electron shell that turns the `../extension` Chrome extension into a
single native desktop app: one window, one icon, no separate "load unpacked
extension in Chrome" step and no separate "run npm run dev for the web app"
step.

## What it actually is

Under the hood this is a small embedded browser:

- A **toolbar** across the top (`extension/toolbar.html`, loaded directly
  from the extension — no duplicated code) with an address bar and the
  step-recording controls.
- A **content view** below it, an embedded Chromium view you can navigate to
  any site — this is where `content.js` (the click-capture logic) actually
  runs, same as it would in a normal Chrome tab.
- The extension is loaded into Electron's session with
  `session.loadExtension()`, so `chrome.storage`, `chrome.runtime`, and the
  content script all work as they would in real Chrome.
- "Record Screen" and "View Guide" open `recorder.html` / `viewer.html` as
  their own windows (same pages the Chrome extension uses — just opened as
  Electron `BrowserWindow`s instead of tabs).

## Two things Electron doesn't give you for free (that Chrome does)

1. **The screen/window picker.** In a real browser, `getDisplayMedia()` pops
   up a native "choose a tab/window/screen" dialog. Electron has no such
   built-in dialog — `main.js` implements `setDisplayMediaRequestHandler`
   and shows its own picker window (`picker/`) built on
   `desktopCapturer.getSources()`.
2. **Format conversion.** The recorder still records to `.webm` via
   `MediaRecorder` (same as the web app), but since this is a real desktop
   process (not a browser tab), it can shell out to a bundled `ffmpeg`
   (via `ffmpeg-static`) to convert to MP4, MOV, or GIF before saving,
   with a native "Save As" dialog. Pick the format from the dropdown next to
   each recording in `recorder.html`.

## Run it

```bash
cd desktop
npm install
npm start
```

First run downloads Electron itself (~100+ MB) via `devDependencies` — that's
normal, not a bug.

## Known rough edges to expect on first real run

This was built and syntax-checked but not click-tested end to end (no
display server available in the build environment), so budget some time to
debug:

- Electron's Chrome-extension API support is broad but not 100% identical to
  real Chrome — if `toolbar.js` throws on some `chrome.*` call, check
  Electron's [extensions support docs](https://www.electronjs.org/docs/latest/api/extensions)
  for what's implemented in your Electron version.
- System-audio loopback capture (`audio: 'loopback'` in the display-media
  handler) has OS-specific quirks, especially on macOS, and may need
  entitlements for a packaged (not dev-run) build.
- No installer/packaging yet (`electron-builder` or similar) — this is a
  `npm start` dev shell, not a distributable `.exe`/`.dmg`.
