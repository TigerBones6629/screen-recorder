const { screen, ipcMain } = require('electron');

let interval = null;

// Polls the OS-level cursor position and streams it to whichever renderer
// asked for it (the control panel, while a screen recording with cursor
// zoom is running). Used to drive the live pan/zoom effect.
function registerCursorTracker() {
  ipcMain.handle('cursor:start', (event) => {
    if (interval) clearInterval(interval);
    const sender = event.sender;
    interval = setInterval(() => {
      if (sender.isDestroyed()) return;
      sender.send('cursor:point', screen.getCursorScreenPoint());
    }, 1000 / 30);
    return true;
  });

  ipcMain.handle('cursor:stop', () => {
    if (interval) clearInterval(interval);
    interval = null;
    return true;
  });
}

module.exports = { registerCursorTracker };
