# Step Recorder

A native desktop app (Windows + macOS, one Electron codebase) that records
your screen or a window, with two optional add-ons you can run separately or
together in the same session:

- **Cursor zoom** — the recording smoothly pans/zooms toward wherever the
  mouse goes, like Loom or Camtasia. A live video effect, no browser needed.
- **Step Guide capture** — click through a website (in the app's own
  built-in browsing pane) and every click becomes a numbered step with a
  screenshot, a highlight box, and an auto-written caption — a Scribe-style
  how-to guide, exportable as HTML or PDF.

Recordings export to MP4, MOV, GIF, or WebM (via a bundled `ffmpeg`), with a
native "Save As" dialog — pick your own destination, not a fixed downloads
folder.

> The previous iterations of this project — a plain web app, then a Chrome
> extension, then an Electron shell wrapping that extension — are archived
> in `_legacy/` rather than deleted, in case anything there is worth
> revisiting. This README describes the current app in the repo root.

## Architecture

One `BrowserWindow` split into two views:

- **Control panel** (`renderer/`) — the toolbar across the top: address bar,
  a "Screen/Window Recording" group (mic, system audio, cursor zoom, output
  format), a "Step Guide Capture" group (step count, View Guide, Clear), and
  one "Start Session" button that starts whichever groups are checked.
  Recording itself — `getDisplayMedia`, the canvas-based cursor-zoom
  compositing, `MediaRecorder` — runs directly in this view's own script
  (`app.js`). No separate recorder window or browser extension needed.
- **Content view** (loads whatever site you type in the address bar) — this
  is where step-guide clicks actually happen. `preload/content-preload.js`
  listens for clicks and reports them to the main process, which takes the
  screenshot itself via `webContents.capturePage()` — Electron's own
  equivalent of `chrome.tabs.captureVisibleTab`, so none of this needs to be
  a browser extension.
- **Picker window** (`renderer/picker/`) — Electron has no built-in "choose a
  screen/window" dialog like Chrome's `getDisplayMedia` picker, so
  `main/displayMedia.js` implements one with `desktopCapturer.getSources()`.
- **Viewer window** (`viewer/`) — renders captured steps as an editable,
  exportable guide.

## macOS system audio

Handled via Chromium's `loopback` audio option for `getDisplayMedia`,
enabled through feature flags in `main/index.js`. Because combining
system-audio-loopback with *video* capture in one call has a known lingering
bug in Chromium/Electron, `app.js` requests them as two separate streams —
a video-only screen capture, and a second, throwaway-video / audio-only
capture purely for the system audio track — then merges the tracks before
recording. Requires macOS 12.3+ (13+ for the more reliable path) and the
user granting Screen Recording permission in System Settings.

## Cursor zoom limitation

The zoom effect maps the OS cursor position onto the recorded video frame
using the chosen display's exact bounds — which only works for "Entire
Screen" sources. Electron has no reliable way to get another process's
window's exact on-screen bounds, so cursor zoom is a no-op (with a status
message explaining why) if you pick a specific window instead of a full
screen.

## Run it

Double-click `launch-windows.bat` (Windows) or `launch-macos.command`
(macOS) — installs dependencies on first run, then starts the app. Or
manually:

```bash
npm install
npm start
```

## Status

Built and click-tested on Windows: the app launches, the menu bar is
hidden, the screen/window picker opens and records, and canceling the
picker no longer crashes the main process (an actual bug found and fixed
during testing — see git history). Electron's own installer had a separate,
unrelated failure mode on Windows worth knowing about if `npm install`
ever silently produces a broken `node_modules/electron` — its postinstall
script can fail to fully download/extract the binary without reporting an
error. If `npm start` throws "Electron failed to install correctly": delete
`node_modules/electron`, reinstall just that package, and confirm
`node_modules/electron/dist/electron.exe` (or the equivalent per platform)
actually exists before assuming the reinstall worked.

Not yet verified:

- **macOS system audio loopback** — implemented per Chromium's documented
  approach (see `main/index.js` and `renderer/app.js`), but only tested on
  Windows so far. Windows system audio capture works differently (no
  loopback trick needed) and has been exercised; the macOS-specific path
  has not.
- **Cursor zoom** on real hardware over a longer recording — works in
  short tests; `MediaRecorder` + `canvas.captureStream()` performance over
  extended sessions on lower-end hardware is unverified.
- **No installer/packaging yet** (`electron-builder` or similar) — this is
  an `npm start` dev shell, not a distributable `.exe`/`.dmg`.
