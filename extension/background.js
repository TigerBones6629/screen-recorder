// background.js (service worker)
// Owns the screenshot capture (content scripts can't call captureVisibleTab
// directly) and the persisted list of steps in chrome.storage.local.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_STEP') {
    const windowId = sender.tab && sender.tab.windowId;
    if (windowId == null) return;

    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        console.warn('Step Recorder: screenshot capture failed', chrome.runtime.lastError);
        return;
      }
      saveStep({ ...message.step, screenshot: dataUrl });
    });
    return true;
  }

  if (message.type === 'TOGGLE_RECORDING') {
    chrome.storage.local.set({ isRecording: message.value });
  }

  if (message.type === 'CLEAR_STEPS') {
    chrome.storage.local.set({ steps: [] });
  }

  return true;
});

function saveStep(step) {
  chrome.storage.local.get(['steps'], (result) => {
    const steps = result.steps || [];
    steps.push(step);
    chrome.storage.local.set({ steps });
  });
}
