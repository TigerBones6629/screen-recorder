const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pickerAPI', {
  listSources: () => ipcRenderer.invoke('picker:list-sources'),
  choose: (sourceId) => ipcRenderer.send('picker:choose', sourceId),
});
