const { contextBridge, ipcRenderer } = require('electron');

// Exposed to extension/recorder.html when opened as its own window from the
// desktop shell. recorder.js feature-detects `window.electronDesktop` to
// switch from a plain <a download> link (real Chrome, .webm only) to this
// save-and-convert flow (any format, via ffmpeg in the main process).
contextBridge.exposeInMainWorld('electronDesktop', {
  isElectron: true,
  saveRecording: (arrayBuffer, format) =>
    ipcRenderer.invoke('recording:save', { buffer: arrayBuffer, format }),
});
