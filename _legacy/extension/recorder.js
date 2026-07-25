// recorder.js
// Screen + mic recording, ported from the screen-recorder app's useRecorder
// hook. Runs on a full extension tab (not the popup) because getDisplayMedia
// needs a real document, and the permission prompt would close a popup.

const recordBtn = document.getElementById('recordBtn');
const ring = document.getElementById('ring');
const badge = document.getElementById('badge');
const timerEl = document.getElementById('timer');
const micToggle = document.getElementById('micToggle');
const sysAudioToggle = document.getElementById('sysAudioToggle');
const micWarning = document.getElementById('micWarning');
const statusbar = document.getElementById('statusbar');
const recordingsList = document.getElementById('recordingsList');

let mediaRecorder = null;
let recordedChunks = [];
let displayStream = null;
let micStream = null;
let combinedStream = null;
let isRecording = false;
let startTime = null;
let timerInterval = null;
const recordings = [];

// Only present when this page is opened inside the desktop shell, not real
// Chrome. Lets us save-and-convert to any format via ffmpeg in the main
// process, instead of just handing back a .webm blob URL.
const isElectron = !!window.electronDesktop;
const FORMATS = isElectron ? ['mp4', 'mov', 'gif', 'webm'] : ['webm'];

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

function updateUI() {
  recordBtn.classList.toggle('recording', isRecording);
  badge.textContent = isRecording ? '● REC' : 'READY';
  badge.classList.toggle('recording', isRecording);
  micToggle.disabled = isRecording;
  sysAudioToggle.disabled = isRecording;
}

async function startRecording() {
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: sysAudioToggle.checked,
    });

    micStream = null;
    if (micToggle.checked) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micWarning.hidden = true;
      } catch (err) {
        micWarning.hidden = false;
        setStatus('Mic permission denied — recording video only.');
      }
    }

    const tracks = [...displayStream.getVideoTracks(), ...displayStream.getAudioTracks()];
    if (micStream) tracks.push(...micStream.getAudioTracks());
    combinedStream = new MediaStream(tracks);

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = handleStop;

    // If the user stops sharing via the browser's own UI, end the recording.
    displayStream.getVideoTracks()[0].addEventListener('ended', () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') stopRecording();
    });

    mediaRecorder.start();
    isRecording = true;
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    timerEl.textContent = '00:00:00';
    updateUI();
    setStatus('Recording...');
  } catch (err) {
    setStatus(`Could not start recording: ${err.message}`);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  clearInterval(timerInterval);
  isRecording = false;
  updateUI();
}

function handleStop() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const duration = Date.now() - startTime;
  const id = Date.now();

  recordings.unshift({ id, url, blob, duration, size: blob.size, format: FORMATS[0] });
  renderRecordings();
  setStatus('Recording saved to this session.');
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

    const info = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = `Recording ${recordings.length - index}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${formatDuration(rec.duration)} · ${formatBytes(rec.size)}`;
    info.appendChild(title);
    info.appendChild(meta);

    li.appendChild(info);

    if (isElectron) {
      const controls = document.createElement('div');
      controls.className = 'save-controls';

      const select = document.createElement('select');
      FORMATS.forEach((format) => {
        const option = document.createElement('option');
        option.value = format;
        option.textContent = format.toUpperCase();
        if (format === rec.format) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener('change', () => {
        rec.format = select.value;
      });

      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save As...';
      saveBtn.addEventListener('click', () => saveElectronRecording(rec, saveBtn));

      controls.appendChild(select);
      controls.appendChild(saveBtn);
      li.appendChild(controls);
    } else {
      const link = document.createElement('a');
      link.href = rec.url;
      link.download = `recording-${rec.id}.webm`;
      link.textContent = 'Download';
      li.appendChild(link);
    }

    recordingsList.appendChild(li);
  });
}

async function saveElectronRecording(rec, saveBtn) {
  const originalLabel = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = rec.format === 'webm' ? 'Saving...' : 'Converting...';
  setStatus(`Saving recording as .${rec.format}...`);

  try {
    const arrayBuffer = await rec.blob.arrayBuffer();
    const result = await window.electronDesktop.saveRecording(arrayBuffer, rec.format);
    if (result.canceled) {
      setStatus('Save canceled.');
    } else {
      setStatus(`Saved to ${result.filePath}`);
    }
  } catch (err) {
    setStatus(`Could not save recording: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}

recordBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

window.addEventListener('beforeunload', () => {
  if (isRecording) stopRecording();
});

renderRecordings();
setStatus('Idle');
