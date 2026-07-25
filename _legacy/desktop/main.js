const { app, BrowserWindow, BrowserView, session, ipcMain, dialog, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const EXTENSION_PATH = path.join(__dirname, '..', 'extension');
const TOOLBAR_HEIGHT = 96;

let mainWindow = null;
let toolbarView = null;
let contentView = null;
let extensionId = null;
let pickerWindow = null;
let pendingDisplayMediaCallback = null;

function layoutViews() {
  if (!mainWindow || !toolbarView || !contentView) return;
  const [width, height] = mainWindow.getContentSize();
  toolbarView.setBounds({ x: 0, y: 0, width, height: TOOLBAR_HEIGHT });
  contentView.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) });
}

function openExtensionWindow(page, { width = 900, height = 700, preload } = {}) {
  const win = new BrowserWindow({
    width,
    height,
    title: 'Step Recorder',
    webPreferences: preload ? { preload, contextIsolation: true } : {},
  });
  win.loadURL(`chrome-extension://${extensionId}/${page}`);
  return win;
}

function showPicker() {
  if (pickerWindow) {
    pickerWindow.focus();
    return;
  }
  pickerWindow = new BrowserWindow({
    width: 640,
    height: 480,
    parent: mainWindow,
    modal: true,
    resizable: false,
    title: 'Choose what to record',
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'picker-preload.js'),
      contextIsolation: true,
    },
  });
  pickerWindow.setMenuBarVisibility(false);
  pickerWindow.loadFile(path.join(__dirname, 'picker', 'index.html'));
  pickerWindow.on('closed', () => {
    pickerWindow = null;
    if (pendingDisplayMediaCallback) {
      pendingDisplayMediaCallback(null);
      pendingDisplayMediaCallback = null;
    }
  });
}

async function createWindow() {
  const extension = await session.defaultSession.loadExtension(EXTENSION_PATH, {
    allowFileAccess: true,
  });
  extensionId = extension.id;

  // Electron won't prompt for mic/screen access on its own the way a real
  // browser tab does — grant the permissions our own app requests.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture');
  });

  // Electron has no built-in "choose a window/screen" dialog like Chrome's
  // getDisplayMedia picker — we supply our own via desktopCapturer.
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      pendingDisplayMediaCallback = (source) => {
        callback(source ? { video: source, audio: 'loopback' } : {});
      };
      showPicker();
    },
    { useSystemPicker: false }
  );

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    title: 'Step Recorder',
  });

  toolbarView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'preload', 'toolbar-preload.js'),
      contextIsolation: true,
    },
  });
  mainWindow.addBrowserView(toolbarView);
  toolbarView.webContents.loadURL(`chrome-extension://${extensionId}/toolbar.html`);

  contentView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
    },
  });
  mainWindow.addBrowserView(contentView);
  contentView.webContents.loadFile(path.join(__dirname, 'start.html'));

  layoutViews();
  mainWindow.on('resize', layoutViews);

  const notifyUrl = (url) => {
    if (toolbarView) toolbarView.webContents.send('url-changed', url);
  };
  contentView.webContents.on('did-navigate', (_e, url) => notifyUrl(url));
  contentView.webContents.on('did-navigate-in-page', (_e, url) => notifyUrl(url));
}

// --- Address bar / navigation, driven from the toolbar extension page ---
ipcMain.on('nav:navigate', (_e, url) => {
  if (!contentView || !url) return;
  const target = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  contentView.webContents.loadURL(target).catch(() => {});
});
ipcMain.on('nav:back', () => {
  if (contentView && contentView.webContents.canGoBack()) contentView.webContents.goBack();
});
ipcMain.on('nav:forward', () => {
  if (contentView && contentView.webContents.canGoForward()) contentView.webContents.goForward();
});
ipcMain.on('nav:reload', () => {
  if (contentView) contentView.webContents.reload();
});

// --- Opening the recorder / viewer extension pages as their own windows ---
ipcMain.on('open:recorder', () => {
  openExtensionWindow('recorder.html', {
    width: 560,
    height: 760,
    preload: path.join(__dirname, 'preload', 'recorder-preload.js'),
  });
});
ipcMain.on('open:viewer', () => {
  openExtensionWindow('viewer.html', { width: 900, height: 800 });
});

// --- Screen-source picker (desktopCapturer) ---
ipcMain.handle('picker:list-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 200 },
  });
  return sources.map((s) => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }));
});

ipcMain.on('picker:choose', async (_event, sourceId) => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
  const chosen = sources.find((s) => s.id === sourceId) || null;
  if (pendingDisplayMediaCallback) {
    pendingDisplayMediaCallback(chosen);
    pendingDisplayMediaCallback = null;
  }
  if (pickerWindow) pickerWindow.close();
});

// --- Save + convert a finished recording ---
ipcMain.handle('recording:save', async (_event, { buffer, format }) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'step-recorder-'));
  const inputPath = path.join(tmpDir, 'recording.webm');
  fs.writeFileSync(inputPath, Buffer.from(buffer));

  try {
    if (format === 'webm') {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: 'recording.webm',
        filters: [{ name: 'WebM Video', extensions: ['webm'] }],
      });
      if (canceled || !filePath) return { canceled: true };
      fs.copyFileSync(inputPath, filePath);
      return { canceled: false, filePath };
    }

    const ext = ['mp4', 'mov', 'gif'].includes(format) ? format : 'mp4';
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `recording.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (canceled || !filePath) return { canceled: true };

    const outputPath = path.join(tmpDir, `recording.${ext}`);
    const args =
      ext === 'gif'
        ? ['-y', '-i', inputPath, '-vf', 'fps=12,scale=720:-1:flags=lanczos', outputPath]
        : ['-y', '-i', inputPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', outputPath];

    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });

    fs.copyFileSync(outputPath, filePath);
    return { canceled: false, filePath };
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
