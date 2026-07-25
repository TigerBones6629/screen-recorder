# Step Recorder

A Chrome extension that captures your clicks as a step-by-step guide — like
Scribe. Turn on recording, click through a workflow, and get a document with
a screenshot, a highlight box around what you clicked, and an auto-generated
caption for every step.

## How it works

- `content.js` runs on every page and listens for clicks while recording is
  active. For each click it walks up to the nearest clickable element
  (button, link, input, etc.), generates a caption from its aria-label,
  title, alt text, placeholder, or visible text, and sends the click's
  position to the background script.
- `background.js` is the service worker. It takes the actual screenshot
  (`chrome.tabs.captureVisibleTab`) since content scripts can't call that API
  directly, and saves each step to `chrome.storage.local`.
- `popup.html` / `popup.js` is the toolbar UI: start/stop recording, see how
  many steps you've captured, open the guide, or clear everything.
- `viewer.html` / `viewer.js` renders the captured steps as an editable
  document — each caption is an editable text field, each screenshot has the
  highlight box drawn on top proportionally (so it works at any zoom level or
  screen size). You can export the guide as a standalone HTML file or print
  it to PDF.
- `recorder.html` / `recorder.js` is a full screen/window recorder — pick
  "Record Screen or Window" from the popup to open it in a new tab. Same
  approach as the standalone `screen-recorder` app: `getDisplayMedia()` for
  the screen/window picker, optional `getUserMedia()` for mic audio, combined
  into a single VP9 `.webm` via `MediaRecorder`. It runs on its own tab
  (rather than in the popup) because the screen-share permission prompt would
  otherwise close the popup before you could grant it.

## Try it locally

1. Open `chrome://extensions`
2. Turn on "Developer mode" (top right)
3. Click "Load unpacked" and select this folder
4. Click the extension icon, hit "Start Recording", click through a workflow
   on any page, then hit "Stop Recording" and "View Guide"

## Status

MVP. Known limitations:

- No redaction of sensitive fields (passwords, etc.) yet — screenshots
  capture whatever is visibly on screen.
- Captions are heuristic-based (element attributes/text), not AI-generated.
- Only captures clicks, not typing, scrolling, or navigation-only steps.

## Roadmap

- Combine step capture and screen recording into a single session, so one
  recording produces both a video and a step-by-step guide.
- Share recording UI/logic with the parent `screen-recorder` app where
  practical (both use plain `getDisplayMedia`/`MediaRecorder`, no extension
  APIs), even though the two projects can't share a build system.
- Optional field redaction for password/sensitive inputs.
- Capture keypress and page-navigation events as steps, not just clicks.
