const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stepRecorder', {
  // Address bar / browsing pane
  navigate: (url) => ipcRenderer.send('nav:navigate', url),
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  onUrlChanged: (callback) => {
    ipcRenderer.on('nav:url-changed', (_event, url) => callback(url));
  },

  // Step guide
  toggleStepGuide: (value) => ipcRenderer.invoke('stepguide:toggle', value),
  clearSteps: () => ipcRenderer.invoke('stepguide:clear'),
  getStepGuideState: () => ipcRenderer.invoke('stepguide:state'),
  openViewer: () => ipcRenderer.send('viewer:open'),

  // Recording source picker / metadata
  getSourceInfo: () => ipcRenderer.invoke('recording:get-source-info'),

  // System audio loopback (macOS-safe manual mode: enable, capture, disable)
  enableLoopbackAudio: () => ipcRenderer.invoke('audio:enable-loopback'),
  disableLoopbackAudio: () => ipcRenderer.invoke('audio:disable-loopback'),

  // Save + convert a finished recording
  saveRecording: (arrayBuffer, format) =>
    ipcRenderer.invoke('recording:save', { buffer: arrayBuffer, format }),

  // Cursor position stream, for the live zoom/pan effect
  startCursorTracking: () => ipcRenderer.invoke('cursor:start'),
  stopCursorTracking: () => ipcRenderer.invoke('cursor:stop'),
  onCursorPoint: (callback) => {
    ipcRenderer.on('cursor:point', (_event, point) => callback(point));
  },
});
