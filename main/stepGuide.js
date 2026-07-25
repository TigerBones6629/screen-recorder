const { ipcMain } = require('electron');

let isRecording = false;
let steps = [];

function registerStepGuideHandlers() {
  ipcMain.handle('stepguide:toggle', (_event, value) => {
    isRecording = !!value;
    return { isRecording, count: steps.length };
  });

  ipcMain.handle('stepguide:clear', () => {
    steps = [];
    return { isRecording, count: steps.length };
  });

  ipcMain.handle('stepguide:state', () => ({ isRecording, count: steps.length }));

  ipcMain.handle('stepguide:get-steps', () => steps);

  ipcMain.handle('stepguide:update-caption', (_event, { index, caption }) => {
    if (steps[index]) steps[index].caption = caption;
    return true;
  });

  // Sent by content-preload.js (running in the browsing view) on every
  // click while step-guide recording is on. We take the screenshot here,
  // in the main process, using the sender's own capturePage() — the
  // Electron-native equivalent of chrome.tabs.captureVisibleTab, no
  // extension APIs required.
  ipcMain.handle('step:capture', async (event, step) => {
    if (!isRecording) return false;
    try {
      const image = await event.sender.capturePage();
      steps.push({ ...step, screenshot: image.toDataURL() });
      return true;
    } catch (err) {
      console.warn('Step Recorder: capturePage failed', err);
      return false;
    }
  });
}

module.exports = { registerStepGuideHandlers };
