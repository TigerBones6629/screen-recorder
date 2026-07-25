const { app, BrowserWindow } = require('electron');

// Chromium's macOS system-audio loopback support (used by displayMedia.js)
// lives behind these feature flags. Harmless no-ops on Windows/Linux.
app.commandLine.appendSwitch(
  'enable-features',
  'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride'
);

const { createMainWindow } = require('./windows');
const { registerDisplayMediaHandlers } = require('./displayMedia');
const { registerStepGuideHandlers } = require('./stepGuide');
const { registerConvertHandlers } = require('./convert');
const { registerCursorTracker } = require('./cursorTracker');

app.whenReady().then(async () => {
  registerDisplayMediaHandlers();
  registerStepGuideHandlers();
  registerConvertHandlers();
  registerCursorTracker();
  await createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
