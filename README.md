# Screen Recorder

A browser-based screen recorder built with React + Vite.

## Features
- Record your entire screen or any window
- Mic + system audio capture
- Session recordings list with individual downloads
- Outputs .webm (VP9) — plays in Chrome, Firefox, Edge, VLC

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in Chrome.

## Build for production

```bash
npm run build
```

## Notes
- Use **Entire Screen** in the browser dialog to capture all windows
- Screen recording permissions required on macOS (System Settings → Privacy & Security → Screen Recording)
- .webm plays natively in Chrome/Firefox/Edge. Use VLC for desktop playback.

## Extension: Step Recorder

The `/extension` folder is a separate Chrome extension (Manifest V3) that
captures clicks as a step-by-step guide, Scribe-style — screenshot, a
highlight box on the clicked element, and an auto-generated caption per step.
It also includes its own screen/window recorder (same getDisplayMedia +
MediaRecorder approach as this app), since a browser extension can do things
this web app can't — like listening for clicks across any tab.

It's a separate architecture (extension manifest, content scripts, a service
worker) rather than a shared codebase, so it lives in its own folder with its
own README. See `extension/README.md` for setup and usage.
