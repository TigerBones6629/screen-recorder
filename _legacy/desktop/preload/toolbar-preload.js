const { contextBridge, ipcRenderer } = require('electron');

// Exposed to extension/toolbar.html (loaded as chrome-extension://<id>/toolbar.html).
// toolbar.js feature-detects `window.electronDesktop` to switch from
// chrome.tabs.create (real Chrome) to these IPC calls (desktop shell).
contextBridge.exposeInMainWorld('electronDesktop', {
  isElectron: true,
  navigate: (url) => ipcRenderer.send('nav:navigate', url),
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  openRecorder: () => ipcRenderer.send('open:recorder'),
  openViewer: () => ipcRenderer.send('open:viewer'),
  onUrlChanged: (callback) => {
    ipcRenderer.on('url-changed', (_event, url) => callback(url));
  },
});
