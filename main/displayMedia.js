const { BrowserWindow, session, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

let pickerWindow = null;
let pendingCallback = null;
let loopbackAudioRequested = false;
let lastChosenSourceInfo = { isScreen: false, bounds: null };

function resolveSourceInfo(source) {
  if (!source) return { isScreen: false, bounds: null };
  const isScreen = source.id.startsWith('screen:');
  if (!isScreen || !source.display_id) return { isScreen, bounds: null };

  const display = screen.getAllDisplays().find((d) => String(d.id) === String(source.display_id));
  return { isScreen, bounds: display ? display.bounds : null };
}

function showPicker(parentWindow) {
  if (pickerWindow) {
    pickerWindow.focus();
    return;
  }
  pickerWindow = new BrowserWindow({
    width: 640,
    height: 480,
    parent: parentWindow || undefined,
    modal: !!parentWindow,
    resizable: false,
    title: 'Choose what to record',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'picker-preload.js'),
      contextIsolation: true,
    },
  });
  pickerWindow.setMenuBarVisibility(false);
  pickerWindow.loadFile(path.join(__dirname, '..', 'renderer', 'picker', 'index.html'));
  pickerWindow.on('closed', () => {
    pickerWindow = null;
    if (pendingCallback) {
      pendingCallback(null);
      pendingCallback = null;
    }
  });
}

function registerDisplayMediaHandlers() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture');
  });

  // Electron has no built-in "choose a window/screen" dialog like Chrome's
  // getDisplayMedia picker — we supply our own via desktopCapturer.
  //
  // Two request shapes come through here:
  //  1. Normal video capture (the recorder picking a screen/window to record).
  //  2. A loopback-audio-only request (renderer briefly re-calls
  //     getDisplayMedia purely to grab system audio, then discards the video
  //     track it's forced to request). We skip the picker for that one and
  //     just hand back the primary screen, since the video is thrown away.
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      if (loopbackAudioRequested) {
        desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
          callback({ video: sources[0], audio: 'loopback' });
        });
        return;
      }

      pendingCallback = (source) => {
        callback(source ? { video: source } : {});
      };
      showPicker(BrowserWindow.getFocusedWindow());
    },
    { useSystemPicker: false }
  );

  ipcMain.handle('picker:list-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 200 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      isScreen: s.id.startsWith('screen:'),
      thumbnail: s.thumbnail.toDataURL(),
    }));
  });

  ipcMain.on('picker:choose', async (_event, sourceId) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    const chosen = sources.find((s) => s.id === sourceId) || null;
    lastChosenSourceInfo = resolveSourceInfo(chosen);
    if (pendingCallback) {
      pendingCallback(chosen);
      pendingCallback = null;
    }
    if (pickerWindow) pickerWindow.close();
  });

  // The renderer calls this right after getDisplayMedia() resolves, to find
  // out whether it can map cursor coordinates onto the captured frame (only
  // reliable for "Entire Screen" sources, where we know the display's exact
  // bounds — a specific window's on-screen bounds aren't something Electron
  // exposes for other processes' windows).
  ipcMain.handle('recording:get-source-info', () => lastChosenSourceInfo);

  ipcMain.handle('audio:enable-loopback', () => {
    loopbackAudioRequested = true;
  });
  ipcMain.handle('audio:disable-loopback', () => {
    loopbackAudioRequested = false;
  });
}

module.exports = { registerDisplayMediaHandlers };
