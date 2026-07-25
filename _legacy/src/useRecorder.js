import { useState, useRef, useCallback } from 'react'

export function useRecorder() {
  const [status, setStatus]     = useState('idle') // idle | recording | stopped
  const [seconds, setSeconds]   = useState(0)
  const [recordings, setRecordings] = useState([])
  const [micBlocked, setMicBlocked] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const streamRef        = useRef(null)
  const secondsRef       = useRef(0)

  const fmt = (s) =>
    Math.floor(s / 60).toString().padStart(2, '0') + ':' +
    (s % 60).toString().padStart(2, '0')

  const start = useCallback(async ({ mic, sysAudio }) => {
    chunksRef.current = []
    setMicBlocked(false)

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: sysAudio,
      })

      let micTracks = []
      if (mic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          micTracks = micStream.getAudioTracks()
        } catch {
          setMicBlocked(true)
        }
      }

      const combined = new MediaStream([...screenStream.getTracks(), ...micTracks])
      streamRef.current = combined

      screenStream.getVideoTracks()[0].addEventListener('ended', stop)

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'

      const recorder = new MediaRecorder(combined, { mimeType })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = handleStop
      recorder.start(1000)

      mediaRecorderRef.current = recorder
      setStatus('recording')
      secondsRef.current = 0
      setSeconds(0)
      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
      }, 1000)

    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        console.error('Recording failed:', err)
      }
    }
  }, [])

  const stop = useCallback(() => {
    clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setStatus('stopped')
  }, [])

  const handleStop = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const url  = URL.createObjectURL(blob)
    const dur  = secondsRef.current
    const size = (blob.size / 1048576).toFixed(1)
    const ts   = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')

    setRecordings((prev) => [...prev, {
      url,
      name: `recording-${ts}.webm`,
      duration: dur,
      durationFmt: fmt(dur),
      sizeMB: size,
    }])
    setStatus('idle')
  }, [])

  const download = useCallback((index) => {
    const r = recordings[index]
    if (!r) return
    const a = document.createElement('a')
    a.href = r.url
    a.download = r.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [recordings])

  return { status, seconds, recordings, micBlocked, fmt, start, stop, download }
}
