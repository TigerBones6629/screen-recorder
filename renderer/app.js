// app.js — the control panel. Runs as a normal renderer (no chrome.*
// extension APIs involved anywhere in this app), talking to the main
// process via the `window.stepRecorder` bridge exposed by shell-preload.js.

const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const addressBar = document.getElementById('addressBar');
const timerEl = document.getElementById('timer');
const sessionBtn = document.getElementById('sessionBtn');
const statusbar = document.getElementById('statusbar');

const recordingToggle = document.getElementById('recordingToggle');
const micToggle = document.getElementById('micToggle');
const sysAudioToggle = document.getElementById('sysAudioToggle');
const cursorZoomToggle = document.getElementById('cursorZoomToggle');
const formatSelect = document.getElementById('formatSelect');

const stepGuideToggle = document.getElementById('stepGuideToggle');
const stepCountEl = document.getElementById('stepCount');
const viewGuideBtn = document.getElementById('viewGuideBtn');
const clearStepsBtn = document.getElementById('clearStepsBtn');

const recordingsList = document.getElementById('recordingsList');

// --- Address bar wiring ---
backBtn.addEventListener('click', () => window.stepRecorder.back());
forwardBtn.addEventListener('click', () => window.stepRecorder.forward());
reloadBtn.addEventListener('click', () => window.stepRecorder.reload());
addressBar.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') window.stepRecorder.navigate(addressBar.value.trim());
});
window.stepRecorder.onUrlChanged((url) => {
  addressBar.value = url;
});

// --- Step guide count polling (no live push channel needed for this) ---
let stepPoll = null;
function refreshStepCount() {
  window.stepRecorder.getStepGuideState().then(({ count }) => {
    stepCountEl.textContent = count;
  });
}

stepGuideToggle.addEventListener('change', () => {
  if (isSessionActive) return; // only takes effect at session start/stop
});

viewGuideBtn.addEventListener('click', () => window.stepRecorder.openViewer());
clearStepsBtn.addEventListener('click', async () => {
  if (confirm('Clear all captured steps?')) {
    await window.stepRecorder.clearSteps();
    refreshStepCount();
  }
});

// --- Session state ---
let isSessionActive = false;
let startTime = null;
let timerInterval = null;

let mediaRecorder = null;
let recordedChunks = [];
let displayStream = null;
let micStream = null;
let loopbackAudioTrack = null;
let cursorZoomActive = false;
let animationFrameId = null;
let latestCursorPoint = null;
let smoothedCursor = null;
let sourceInfo = { isScreen: false, bounds: null };
let hiddenVideoEl = null;
let canvasEl = null;
const recordings = [];

function setStatus(text) {
  statusbar.textContent = text;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateTimer() {
  timerEl.textContent = formatDuration(Date.now() - startTime);
}

function setSessionUI(active) {
  sessionBtn.textContent = active ? 'Stop Session' : 'Start Session';
  sessionBtn.classList.toggle('active', active);
  [recordingToggle, micToggle, sysAudioToggle, cursorZoomToggle, formatSelect, stepGuideToggle].forEach((el) => {
    el.disabled = active;
  });
}

// --- Cursor-zoom compositing (live, via canvas) ---
window.stepRecorder.onCursorPoint((point) => {
  latestCursorPoint = point;
});

function startCursorZoomLoop(rawStream) {
  hiddenVideoEl = document.createElement('video');
  hiddenVideoEl.srcObject = rawStream;
  hiddenVideoEl.muted = true;
  hiddenVideoEl.play();

  canvasEl = document.createElement('canvas');
  const ctx = canvasEl.getContext('2d');

  return new Promise((resolve) => {
    hiddenVideoEl.addEventListener('loadedmetadata', () => {
      canvasEl.width = hiddenVideoEl.videoWidth;
      canvasEl.height = hiddenVideoEl.videoHeight;
      cursorZoomActive = true;

      const ZOOM = 1.6;
      const scaleX = canvasEl.width / sourceInfo.bounds.width;
      const scaleY = canvasEl.height / sourceInfo.bounds.height;

      const draw = () => {
        if (!cursorZoomActive) return;

        let targetX = canvasEl.width / 2;
        let targetY = canvasEl.height / 2;
        if (latestCursorPoint) {
          targetX = (latestCursorPoint.x - sourceInfo.bounds.x) * scaleX;
          targetY = (latestCursorPoint.y - sourceInfo.bounds.y) * scaleY;
        }

        if (!smoothedCursor) smoothedCursor = { x: targetX, y: targetY };
        smoothedCursor.x += (targetX - smoothedCursor.x) * 0.08;
        smoothedCursor.y += (targetY - smoothedCursor.y) * 0.08;

        const cropW = canvasEl.width / ZOOM;
        const cropH = canvasEl.height / ZOOM;
        let cropX = smoothedCursor.x - cropW / 2;
        let cropY = smoothedCursor.y - cropH / 2;
        cropX = Math.max(0, Math.min(canvasEl.width - cropW, cropX));
        cropY = Math.max(0, Math.min(canvasEl.height - cropH, cropY));

        ctx.drawImage(hiddenVideoEl, cropX, cropY, cropW, cropH, 0, 0, canvasEl.width, canvasEl.height);
        animationFrameId = requestAnimationFrame(draw);
      };

      draw();
      resolve(canvasEl.captureStream(30));
    });
  });
}

function stopCursorZoomLoop() {
  cursorZoomActive = false;
  smoothedCursor = null;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (hiddenVideoEl) {
    hiddenVideoEl.pause();
    hiddenVideoEl.srcObject = null;
  }
  hiddenVideoEl = null;
  canvasEl = null;
}

// --- Recording ---
async function startScreenRecording() {
  displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  sourceInfo = await window.stepRecorder.getSourceInfo();

  micStream = null;
  if (micToggle.checked) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setStatus('Mic permission denied — recording without mic audio.');
    }
  }

  loopbackAudioTrack = null;
  if (sysAudioToggle.checked) {
    try {
      await window.stepRecorder.enableLoopbackAudio();
      const audioProbe = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      audioProbe.getVideoTracks().forEach((t) => t.stop());
      loopbackAudioTrack = audioProbe.getAudioTracks()[0] || null;
    } catch (err) {
      setStatus('Could not capture system audio — continuing without it.');
    } finally {
      await window.stepRecorder.disableLoopbackAudio();
    }
  }

  let videoTracks = displayStream.getVideoTracks();
  const canUseCursorZoom = cursorZoomToggle.checked && sourceInfo.isScreen && sourceInfo.bounds;
  if (cursorZoomToggle.checked && !canUseCursorZoom) {
    setStatus('Cursor zoom only works for "Entire Screen" sources — recording without it.');
  }

  if (canUseCursorZoom) {
    await window.stepRecorder.startCursorTracking();
    const canvasStream = await startCursorZoomLoop(displayStream);
    videoTracks = canvasStream.getVideoTracks();
  }

  const tracks = [...videoTracks];
  if (micStream) tracks.push(...micStream.getAudioTracks());
  if (loopbackAudioTrack) tracks.push(loopbackAudioTrack);

  const combinedStream = new MediaStream(tracks);
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = handleRecordingStop;

  displayStream.getVideoTracks()[0].addEventListener('ended', () => {
    if (isSessionActive) stopSession();
  });

  mediaRecorder.start();
}

function stopScreenRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (loopbackAudioTrack) loopbackAudioTrack.stop();
  if (cursorZoomActive) {
    window.stepRecorder.stopCursorTracking();
    stopCursorZoomLoop();
  }
}

function handleRecordingStop() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const duration = Date.now() - startTime;
  const id = Date.now();
  recordings.unshift({ id, blob, duration, size: blob.size, format: formatSelect.value });
  renderRecordings();
}

function renderRecordings() {
  recordingsList.innerHTML = '';

  if (!recordings.length) {
    recordingsList.innerHTML = '<li class="empty">No recordings yet this session.</li>';
    return;
  }

  recordings.forEach((rec, index) => {
    const li = document.createElement('li');
    li.className = 'recording-item';

    const info = document.createElement('span');
    info.className = 'meta';
    info.textContent = `#${recordings.length - index} · ${formatDuration(rec.duration)} · ${formatBytes(rec.size)}`;
    li.appendChild(info);

    const select = document.createElement('select');
    ['mp4', 'mov', 'gif', 'webm'].forEach((format) => {
      const option = document.createElement('option');
      option.value = format;
      option.textContent = format.toUpperCase();
      if (format === rec.format) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      rec.format = select.value;
    });
    li.appendChild(select);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save As...';
    saveBtn.addEventListener('click', () => saveRecording(rec, saveBtn));
    li.appendChild(saveBtn);

    recordingsList.appendChild(li);
  });
}

async function saveRecording(rec, saveBtn) {
  const originalLabel = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = rec.format === 'webm' ? 'Saving...' : 'Converting...';
  setStatus(`Saving recording as .${rec.format}...`);

  try {
    const arrayBuffer = await rec.blob.arrayBuffer();
    const result = await window.stepRecorder.saveRecording(arrayBuffer, rec.format);
    setStatus(result.canceled ? 'Save canceled.' : `Saved to ${result.filePath}`);
  } catch (err) {
    setStatus(`Could not save recording: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}

// --- Session control (drives recording + step guide together) ---
async function startSession() {
  if (!recordingToggle.checked && !stepGuideToggle.checked) {
    setStatus('Turn on Screen Recording and/or Step Guide Capture first.');
    return;
  }

  isSessionActive = true;
  setSessionUI(true);
  startTime = Date.now();
  timerEl.textContent = '00:00:00';
  timerInterval = setInterval(updateTimer, 1000);

  try {
    if (stepGuideToggle.checked) {
      await window.stepRecorder.toggleStepGuide(true);
      stepPoll = setInterval(refreshStepCount, 1000);
    }
    if (recordingToggle.checked) {
      await startScreenRecording();
    }
    setStatus('Session running...');
  } catch (err) {
    setStatus(`Could not start session: ${err.message}`);
    await stopSession();
  }
}

async function stopSession() {
  isSessionActive = false;
  setSessionUI(false);
  clearInterval(timerInterval);
  clearInterval(stepPoll);

  if (recordingToggle.checked) stopScreenRecording();
  if (stepGuideToggle.checked) {
    await window.stepRecorder.toggleStepGuide(false);
    refreshStepCount();
  }

  setStatus('Session stopped.');
}

sessionBtn.addEventListener('click', () => {
  if (isSessionActive) {
    stopSession();
  } else {
    startSession();
  }
});

window.addEventListener('beforeunload', () => {
  if (isSessionActive) stopSession();
});

renderRecordings();
refreshStepCount();
setStatus('Idle');
