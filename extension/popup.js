const toggleBtn = document.getElementById('toggleBtn');
const statusText = document.getElementById('statusText');
const stepCountEl = document.getElementById('stepCount');
const viewBtn = document.getElementById('viewBtn');
const clearBtn = document.getElementById('clearBtn');
const screenRecordBtn = document.getElementById('screenRecordBtn');

function refresh() {
  chrome.storage.local.get(['isRecording', 'steps'], ({ isRecording, steps }) => {
    const recording = !!isRecording;
    toggleBtn.textContent = recording ? 'Stop Recording' : 'Start Recording';
    toggleBtn.classList.toggle('recording', recording);
    statusText.textContent = recording
      ? 'Recording — click through your workflow'
      : 'Not recording';
    stepCountEl.textContent = (steps || []).length;
  });
}

toggleBtn.addEventListener('click', () => {
  chrome.storage.local.get(['isRecording'], ({ isRecording }) => {
    const next = !isRecording;
    chrome.runtime.sendMessage({ type: 'TOGGLE_RECORDING', value: next });
    setTimeout(refresh, 50);
  });
});

viewBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
});

clearBtn.addEventListener('click', () => {
  if (confirm('Clear all captured steps?')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_STEPS' });
    setTimeout(refresh, 50);
  }
});

screenRecordBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('recorder.html') });
});

chrome.storage.onChanged.addListener(refresh);
refresh();
