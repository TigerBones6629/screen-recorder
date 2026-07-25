// toolbar.js
// Runs as an extension page (chrome-extension://<id>/toolbar.html), loaded
// into the desktop shell's toolbar BrowserView. Has full chrome.storage /
// chrome.runtime access like any other extension page. Feature-detects
// window.electronDesktop (only present inside the desktop shell) to drive
// the address bar and open recorder/viewer windows via IPC instead of
// chrome.tabs.create.

const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const addressBar = document.getElementById('addressBar');
const stepBadge = document.getElementById('stepBadge');
const toggleStepBtn = document.getElementById('toggleStepBtn');
const stepCountEl = document.getElementById('stepCount');
const viewGuideBtn = document.getElementById('viewGuideBtn');
const clearStepsBtn = document.getElementById('clearStepsBtn');
const screenRecordBtn = document.getElementById('screenRecordBtn');

const isElectron = !!window.electronDesktop;

function refreshStepState() {
  chrome.storage.local.get(['isRecording', 'steps'], ({ isRecording, steps }) => {
    const recording = !!isRecording;
    stepBadge.textContent = recording ? 'STEPS: ON' : 'STEPS: OFF';
    stepBadge.classList.toggle('active', recording);
    toggleStepBtn.textContent = recording ? 'Stop Step Recording' : 'Start Step Recording';
    stepCountEl.textContent = (steps || []).length;
  });
}

toggleStepBtn.addEventListener('click', () => {
  chrome.storage.local.get(['isRecording'], ({ isRecording }) => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_RECORDING', value: !isRecording });
    setTimeout(refreshStepState, 50);
  });
});

clearStepsBtn.addEventListener('click', () => {
  if (confirm('Clear all captured steps?')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_STEPS' });
    setTimeout(refreshStepState, 50);
  }
});

viewGuideBtn.addEventListener('click', () => {
  if (isElectron) {
    window.electronDesktop.openViewer();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
  }
});

screenRecordBtn.addEventListener('click', () => {
  if (isElectron) {
    window.electronDesktop.openRecorder();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('recorder.html') });
  }
});

if (isElectron) {
  backBtn.addEventListener('click', () => window.electronDesktop.back());
  forwardBtn.addEventListener('click', () => window.electronDesktop.forward());
  reloadBtn.addEventListener('click', () => window.electronDesktop.reload());
  addressBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') window.electronDesktop.navigate(addressBar.value.trim());
  });
  window.electronDesktop.onUrlChanged((url) => {
    addressBar.value = url;
  });
} else {
  // This toolbar page is only ever loaded inside the desktop shell today —
  // real Chrome installs use popup.html instead — but disable the
  // browsing controls gracefully if it's ever opened standalone.
  [backBtn, forwardBtn, reloadBtn, addressBar].forEach((el) => {
    el.disabled = true;
  });
}

chrome.storage.onChanged.addListener(refreshStepState);
refreshStepState();
