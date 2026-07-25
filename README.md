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
