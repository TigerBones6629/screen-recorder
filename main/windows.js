const { BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

const PANEL_HEIGHT = 230;

let mainWindow = null;
let panelView = null;
let contentView = null;
let viewerWindow = null;

function layoutViews() {
  if (!mainWindow || !panelView || !contentView) return;
  const [width, height] = mainWindow.getContentSize();
  panelView.setBounds({ x: 0, y: 0, width, height: PANEL_HEIGHT });
  contentView.setBounds({ x: 0, y: PANEL_HEIGHT, width, height: Math.max(0, height - PANEL_HEIGHT) });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Step Recorder',
  });

  panelView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'shell-preload.js'),
      contextIsolation: true,
    },
  });
  mainWindow.addBrowserView(panelView);
  panelView.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  contentView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'content-preload.js'),
      contextIsolation: true,
    },
  });
  mainWindow.addBrowserView(contentView);
  contentView.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'start.html'));

  layoutViews();
  mainWindow.on('resize', layoutViews);

  const notifyUrl = (url) => {
    if (panelView) panelView.webContents.send('nav:url-changed', url);
  };
  contentView.webContents.on('did-navigate', (_e, url) => notifyUrl(url));
  contentView.webContents.on('did-navigate-in-page', (_e, url) => notifyUrl(url));

  return mainWindow;
}

function getContentView() {
  return contentView;
}

function getPanelView() {
  return panelView;
}

function openViewerWindow() {
  if (viewerWindow) {
    viewerWindow.focus();
    return viewerWindow;
  }
  viewerWindow = new BrowserWindow({
    width: 900,
    height: 800,
    title: 'Step Guide',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'viewer-preload.js'),
      contextIsolation: true,
    },
  });
  viewerWindow.loadFile(path.join(__dirname, '..', 'viewer', 'index.html'));
  viewerWindow.on('closed', () => {
    viewerWindow = null;
  });
  return viewerWindow;
}

// --- Address bar navigation for the content view ---
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

ipcMain.on('viewer:open', () => openViewerWindow());

module.exports = {
  createMainWindow,
  getContentView,
  getPanelView,
  openViewerWindow,
  layoutViews,
};
