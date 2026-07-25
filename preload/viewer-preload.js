const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stepViewer', {
  getSteps: () => ipcRenderer.invoke('stepguide:get-steps'),
  updateCaption: (index, caption) => ipcRenderer.invoke('stepguide:update-caption', { index, caption }),
});
