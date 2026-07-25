import { useState } from 'react'
import { useRecorder } from './useRecorder'
import './App.css'

export default function App() {
  const [mic, setMic]           = useState(true)
  const [sysAudio, setSysAudio] = useState(true)

  const { status, seconds, recordings, micBlocked, fmt, start, stop, download } = useRecorder()

  const isRecording = status === 'recording'

  function handleRecord() {
    if (isRecording) stop()
    else start({ mic, sysAudio })
  }

  return (
    <div className="layout">

      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-dot" />
          Screen Recorder
        </div>
        <span className={`badge ${isRecording ? 'badge-red' : 'badge-default'}`}>
          {isRecording ? '● REC' : 'READY'}
        </span>
      </header>

      {/* Main */}
      <div className="main">

        {/* Sidebar */}
        <aside className="sidebar">

          <section>
            <p className="section-label">Settings</p>

            <SettingRow label="Microphone" sub="Record your voice">
              <Toggle checked={mic} onChange={setMic} disabled={isRecording} />
            </SettingRow>

            <SettingRow label="System audio" sub="Capture app sounds">
              <Toggle checked={sysAudio} onChange={setSysAudio} disabled={isRecording} />
            </SettingRow>
          </section>

          <section className="recordings-section">
            <p className="section-label">This session</p>
            <div className="recordings-list">
              {recordings.length === 0 ? (
                <div className="empty-state">No recordings yet</div>
              ) : (
                recordings.map((r, i) => (
                  <div className="rec-item" key={i}>
                    <div className="rec-info">
                      <div className="rec-name">Recording {i + 1}</div>
                      <div className="rec-meta">{r.durationFmt} · {r.sizeMB} MB</div>
                    </div>
                    <button className="rec-btn" onClick={() => download(i)}>↓ Save</button>
                  </div>
                ))
              )}
            </div>
          </section>

        </aside>

        {/* Center */}
        <div className="center">

          <div className="timer-wrap">
            <div className={`timer ${isRecording ? '' : 'timer-muted'}`}>
              {fmt(seconds)}
            </div>
            <div className="timer-label">
              {isRecording ? 'Recording' : seconds > 0 ? 'Last recording' : 'Ready'}
            </div>
          </div>

          <div className="btn-wrap">
            <div className={`btn-ring ${isRecording ? 'btn-ring-active' : ''}`} />
            <button
              className={`record-btn ${isRecording ? 'record-btn-active' : ''}`}
              onClick={handleRecord}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <div className={`btn-inner ${isRecording ? 'btn-inner-stop' : ''}`} />
            </button>
          </div>

          <div className="status-row">
            {isRecording && <div className="status-dot" />}
            <span className="status-text">
              {isRecording
                ? 'Recording — click to stop'
                : recordings.length > 0
                ? `${recordings.length} recording${recordings.length > 1 ? 's' : ''} saved this session`
                : 'Choose Entire Screen in the browser dialog to capture all windows'}
            </span>
          </div>

          {micBlocked && (
            <p className="mic-warn">⚠ Mic access denied — recording screen only</p>
          )}

        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-item">
          <div className={`footer-dot ${isRecording ? 'footer-dot-red' : ''}`} />
          {isRecording
            ? 'Recording in progress'
            : recordings.length > 0
            ? `Idle — ${recordings.length} recording${recordings.length > 1 ? 's' : ''} this session`
            : 'Ready to record'}
        </div>
        <div className="footer-item">Format: .webm (VP9)</div>
        <div className="footer-item">🎙 Mic: {mic ? 'on' : 'off'}</div>
      </footer>

    </div>
  )
}

function SettingRow({ label, sub, children }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-label">{label}</div>
        <div className="setting-sub">{sub}</div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <label className={`toggle ${disabled ? 'toggle-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className="toggle-track">
        <div className="toggle-thumb" />
      </div>
    </label>
  )
}
