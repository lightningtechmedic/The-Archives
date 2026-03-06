'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const PULSE_CSS = `
@keyframes voiceRing {
  0%   { transform: scale(1); opacity: 0.55; }
  100% { transform: scale(2.8); opacity: 0; }
}
@keyframes voiceSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes voiceFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes voiceSuccess {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.14); }
  100% { transform: scale(1); }
}
`

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function VoiceCapture({ user, enclaves, onOpenNote }) {
  const [mode, setMode] = useState('idle')        // idle | recording | processing | success
  const [duration, setDuration] = useState(0)
  const [interimText, setInterimText] = useState('')
  const [waveform, setWaveform] = useState([0, 0, 0, 0, 0])
  const [destination, setDestination] = useState('personal')
  const [destOpen, setDestOpen] = useState(false)
  const [lastTitle, setLastTitle] = useState('')
  const [toast, setToast] = useState(null)
  const [recentNotes, setRecentNotes] = useState([])
  const [permError, setPermError] = useState(null)  // null | 'denied' | 'error'
  const [speechOk, setSpeechOk] = useState(true)

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const finalTextRef = useRef('')
  const startTimeRef = useRef(0)
  const durationTimerRef = useRef(null)
  const animRef = useRef(null)
  const pressTimeRef = useRef(0)
  const holdTimerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) setSpeechOk(false)

    const saved = localStorage.getItem('vault_voice_destination') || 'personal'
    const valid = saved === 'personal' || enclaves.some(e => e.id === saved)
    setDestination(valid ? saved : 'personal')

    loadRecentNotes()
    return () => {
      clearInterval(durationTimerRef.current)
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line

  async function loadRecentNotes() {
    const sb = createClient()
    const { data } = await sb.from('notes')
      .select('id, title, created_at, enclave_id')
      .eq('user_id', user.id)
      .eq('source_type', 'voice')
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setRecentNotes(data)
  }

  async function startRecording() {
    if (mode !== 'idle') return
    setPermError(null)
    setInterimText('')
    finalTextRef.current = ''
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Web Audio analyser for waveform visualization
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 32
        source.connect(analyser)
        analyserRef.current = analyser
        animateWaveform()
      } catch (e) { /* waveform optional */ }

      // MediaRecorder — with MIME type fallback for iOS
      try {
        const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        mr.start(100)
        mediaRecorderRef.current = mr
      } catch (e) { /* audio capture optional, transcript-only fallback */ }

      // SpeechRecognition
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = e => {
        let final = '', interim = ''
        for (const result of e.results) {
          if (result.isFinal) final += result[0].transcript + ' '
          else interim += result[0].transcript
        }
        if (final) finalTextRef.current += final
        setInterimText(interim)
      }
      rec.onerror = () => {}
      rec.start()
      recognitionRef.current = rec

      startTimeRef.current = Date.now()
      setDuration(0)
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)

      setMode('recording')
    } catch (err) {
      setPermError(err.name === 'NotAllowedError' ? 'denied' : 'error')
    }
  }

  async function stopRecording() {
    if (mode !== 'recording') return
    setMode('processing')
    clearInterval(durationTimerRef.current)
    cancelAnimationFrame(animRef.current)
    analyserRef.current = null
    setWaveform([0, 0, 0, 0, 0])
    setInterimText('')

    recognitionRef.current?.stop()
    recognitionRef.current = null

    await new Promise(resolve => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') { resolve(); return }
      mr.onstop = resolve
      mr.stop()
    })

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    // Give SpeechRecognition a moment to flush remaining results
    await new Promise(r => setTimeout(r, 600))
    await saveNote()
  }

  async function saveNote() {
    const sb = createClient()
    const text = finalTextRef.current.trim()

    const words = text.split(/\s+/).filter(Boolean)
    const title = words.length > 0
      ? words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '')
      : `Voice note — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

    let content = text

    // Upload audio to Supabase Storage
    if (chunksRef.current.length > 0) {
      try {
        const mimeType = chunksRef.current[0]?.type || 'audio/webm'
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const filePath = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadErr } = await sb.storage.from('voice-recordings').upload(filePath, blob)
        if (!uploadErr) {
          const { data: urlData } = sb.storage.from('voice-recordings').getPublicUrl(filePath)
          if (content) content += '\n\n'
          content += `[voice-recording]: ${urlData.publicUrl}`
        }
      } catch (e) { /* upload failed — save transcript only */ }
    }

    const isEnclave = destination !== 'personal'
    await sb.from('notes').insert({
      user_id: user.id,
      title,
      content: content || title,
      visibility: isEnclave ? 'enclave' : 'private',
      enclave_id: isEnclave ? destination : null,
      source_type: 'voice',
    })

    setMode('success')
    setLastTitle(title)
    if (typeof navigator.vibrate === 'function') navigator.vibrate([100, 50, 200])

    const enc = enclaves.find(e => e.id === destination)
    const destName = isEnclave ? `◆ ${enc?.name || 'Enclave'}` : 'Personal'
    setToast({ title, dest: destName })
    setTimeout(() => setToast(null), 3000)
    setTimeout(() => setMode('idle'), 1600)

    loadRecentNotes()
  }

  function animateWaveform() {
    if (!analyserRef.current) return
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount)
    function frame() {
      if (!analyserRef.current) return
      analyserRef.current.getByteFrequencyData(buf)
      const step = Math.floor(buf.length / 5)
      const data = Array.from({ length: 5 }, (_, i) => {
        const slice = buf.slice(i * step, (i + 1) * step)
        return slice.reduce((a, b) => a + b, 0) / slice.length / 255
      })
      setWaveform(data)
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
  }

  // ── Touch interaction (hold-to-record + tap-to-toggle) ──
  function handlePointerDown(e) {
    e.preventDefault()
    pressTimeRef.current = Date.now()
    if (mode === 'idle') {
      startRecording()
      // If user holds > 500ms, flag as hold-to-record
      holdTimerRef.current = setTimeout(() => { holdTimerRef.current = 'hold' }, 500)
    } else if (mode === 'recording') {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      stopRecording()
    }
  }

  function handlePointerUp(e) {
    e.preventDefault()
    if (holdTimerRef.current === 'hold' && mode === 'recording') {
      stopRecording()
    } else {
      clearTimeout(holdTimerRef.current)
    }
    holdTimerRef.current = null
  }

  const enc = enclaves.find(e => e.id === destination)
  const destLabel = destination === 'personal' ? 'Personal' : `◆ ${enc?.name || 'Enclave'}`
  const isRecording = mode === 'recording'
  const isProcessing = mode === 'processing'
  const isSuccess = mode === 'success'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: '#0b0a08',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      paddingTop: '56px', overflowY: 'auto',
    }}>
      <style>{PULSE_CSS}</style>

      {/* Ember radial glow behind mic when recording */}
      {isRecording && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,84,26,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Brand mark */}
      <div style={{ position: 'absolute', top: '68px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '.45rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ember)' }} />
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '.95rem', fontWeight: 300, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)' }}>
          The <em style={{ color: 'var(--ember)' }}>Vault</em>
        </span>
      </div>

      {/* Speech not supported */}
      {!speechOk && (
        <div style={{ textAlign: 'center', padding: '0 2.5rem', maxWidth: 340 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.58rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', lineHeight: 1.9 }}>
            Voice capture requires Chrome or Samsung Browser on Android, or Chrome on iOS
          </p>
        </div>
      )}

      {speechOk && (
        <>
          {/* Permission error */}
          {permError === 'denied' && (
            <div style={{ textAlign: 'center', padding: '0 2rem', marginBottom: '1.5rem', maxWidth: 300 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.56rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(212,84,26,0.8)', lineHeight: 1.9 }}>
                Microphone access denied.<br />
                Open Settings → Safari/Chrome → allow Microphone access.
              </p>
            </div>
          )}

          {/* ── Mic button area ── */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.75rem' }}>
            {/* Pulse rings */}
            {isRecording && [0.8, 1.2, 1.6].map((dur, i) => (
              <div key={i} style={{
                position: 'absolute', width: 120, height: 120, borderRadius: '50%',
                border: '1.5px solid rgba(212,84,26,0.45)',
                animation: `voiceRing ${dur}s ease-out infinite`,
                animationDelay: `${i * 0.28}s`,
                pointerEvents: 'none',
              }} />
            ))}

            {/* Button */}
            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                width: 120, height: 120, borderRadius: '50%',
                background: isSuccess
                  ? 'rgba(80,200,100,0.18)'
                  : isRecording ? 'rgba(212,84,26,0.9)' : 'rgba(212,84,26,0.12)',
                border: `2px solid ${isSuccess
                  ? 'rgba(80,200,100,0.55)'
                  : isRecording ? 'rgba(212,84,26,0.85)' : 'rgba(212,84,26,0.4)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', zIndex: 2,
                animation: isSuccess ? 'voiceSuccess .45s ease' : 'none',
                transition: 'background .25s, border-color .25s',
                userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none',
              }}
            >
              {isProcessing ? (
                <svg width={44} height={44} viewBox="0 0 44 44" style={{ animation: 'voiceSpin .75s linear infinite' }}>
                  <circle cx={22} cy={22} r={17} fill="none" stroke="rgba(212,84,26,0.25)" strokeWidth={2.5} />
                  <path d="M 22 5 A 17 17 0 0 1 39 22" fill="none" stroke="var(--ember)" strokeWidth={2.5} strokeLinecap="round" />
                </svg>
              ) : isSuccess ? (
                <svg width={44} height={44} viewBox="0 0 44 44">
                  <path d="M 11 22 L 19 31 L 33 13" fill="none" stroke="rgba(80,200,100,0.9)" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width={44} height={44} viewBox="0 0 44 44" fill="none">
                  <rect x={17} y={7} width={10} height={17} rx={5} fill={isRecording ? '#fff' : 'var(--ember)'} />
                  <path d="M 9 22 Q 9 34 22 34 Q 35 34 35 22" stroke={isRecording ? '#fff' : 'var(--ember)'} strokeWidth={2.2} fill="none" strokeLinecap="round" />
                  <line x1={22} y1={34} x2={22} y2={39} stroke={isRecording ? '#fff' : 'var(--ember)'} strokeWidth={2.2} strokeLinecap="round" />
                  <line x1={15} y1={39} x2={29} y2={39} stroke={isRecording ? '#fff' : 'var(--ember)'} strokeWidth={2.2} strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>

          {/* Waveform bars */}
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 36, marginBottom: '.65rem' }}>
              {waveform.map((v, i) => (
                <div key={i} style={{
                  width: 5, borderRadius: 3,
                  background: 'var(--ember)',
                  height: Math.max(4, v * 32) + 'px',
                  opacity: 0.5 + v * 0.5,
                  transition: 'height .08s',
                }} />
              ))}
            </div>
          )}

          {/* Interim transcript ghost */}
          {isRecording && interimText && (
            <p style={{
              fontFamily: 'var(--font-caveat)', fontSize: '1rem',
              color: 'rgba(255,255,255,0.3)', maxWidth: 260,
              textAlign: 'center', lineHeight: 1.5, marginBottom: '.5rem', fontStyle: 'italic',
            }}>
              {interimText}
            </p>
          )}

          {/* Status line */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.54rem', letterSpacing: '.12em', color: 'var(--muted)', marginBottom: '1.5rem', minHeight: '1.2em', textAlign: 'center' }}>
            {isRecording && fmt(duration)}
            {isProcessing && 'Transcribing…'}
            {mode === 'idle' && !permError && 'Tap or hold to record'}
          </div>

          {/* Last saved */}
          {lastTitle && mode === 'idle' && (
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '.5rem', letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'var(--ember)',
              animation: 'voiceFadeUp .4s ease', marginBottom: '.75rem',
              maxWidth: 280, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Saved — {lastTitle}
            </p>
          )}

          {/* Destination selector */}
          <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
            <button
              onClick={() => setDestOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '.4rem',
                padding: '.38rem .85rem', background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)', borderRadius: '4px',
                color: 'var(--muted)', fontFamily: 'var(--font-mono)',
                fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {destination !== 'personal' && <span style={{ color: 'var(--ember)', fontSize: '.55rem' }}>◆</span>}
              {destLabel}
              <span style={{ opacity: .45, fontSize: '.5rem', marginLeft: 2 }}>▾</span>
            </button>

            {destOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '100%',
                background: 'rgba(11,10,8,0.97)', border: '1px solid var(--border)',
                borderRadius: '4px', zIndex: 60, overflow: 'hidden',
              }}>
                {[{ id: 'personal', label: 'Personal' }, ...enclaves.map(e => ({ id: e.id, label: `◆ ${e.name}` }))].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setDestination(opt.id)
                      localStorage.setItem('vault_voice_destination', opt.id)
                      setDestOpen(false)
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '.45rem .85rem', background: destination === opt.id ? 'rgba(212,84,26,0.1)' : 'transparent',
                      border: 'none', color: destination === opt.id ? 'var(--ember)' : 'var(--muted)',
                      fontFamily: 'var(--font-mono)', fontSize: '.52rem', letterSpacing: '.1em',
                      textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent voice notes */}
          {recentNotes.length > 0 && (
            <div style={{ width: '100%', maxWidth: 320, padding: '0 1.5rem' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.44rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)', marginBottom: '.6rem' }}>
                Recent
              </p>
              {recentNotes.map(note => {
                const noteEnc = enclaves.find(e => e.id === note.enclave_id)
                const noteDest = noteEnc ? `◆ ${noteEnc.name}` : 'Personal'
                return (
                  <button
                    key={note.id}
                    onClick={() => onOpenNote(note)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '.55rem 0', background: 'transparent', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                    }}
                  >
                    <p style={{ fontFamily: 'var(--font-caveat)', fontSize: '1rem', color: 'var(--text)', marginBottom: '.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {note.title || 'Untitled'}
                    </p>
                    <div style={{ display: 'flex', gap: '.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.44rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{noteDest}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.44rem', color: 'rgba(255,255,255,0.2)' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.44rem', color: 'rgba(255,255,255,0.2)' }}>{relTime(note.created_at)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Save toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(212,84,26,0.95)', border: '1px solid rgba(212,84,26,0.6)',
          borderRadius: '6px', padding: '.75rem 1.25rem', zIndex: 70,
          animation: 'voiceFadeUp .3s ease', textAlign: 'center', maxWidth: 300,
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '.48rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '.25rem' }}>
            ✓ Saved to {toast.dest}
          </p>
          <p style={{ fontFamily: 'var(--font-caveat)', fontSize: '.95rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {toast.title}
          </p>
        </div>
      )}
    </div>
  )
}
