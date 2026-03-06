'use client'

import { useState, useRef } from 'react'

function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`
}

export default function AudioPlayer({ url }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  function toggle() {
    if (!audioRef.current) return
    if (playing) audioRef.current.pause()
    else audioRef.current.play()
    setPlaying(!playing)
  }

  function seek(e) {
    if (!audioRef.current || !audioRef.current.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = pct * audioRef.current.duration
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '.75rem',
      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
      borderRadius: '6px', padding: '.7rem 1rem', marginBottom: '.75rem', flexShrink: 0,
    }}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={e => {
          setCurrent(e.target.currentTime)
          setProgress(e.target.currentTime / (e.target.duration || 1) * 100)
        }}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onEnded={() => setPlaying(false)}
      />

      {/* Play / pause */}
      <button onClick={toggle} style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '1px solid rgba(212,84,26,0.5)', background: 'rgba(212,84,26,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, transition: 'background .15s',
      }}>
        {playing
          ? <svg width={10} height={10} viewBox="0 0 10 10">
              <rect x={1} y={0} width={3} height={10} fill="var(--ember)" />
              <rect x={6} y={0} width={3} height={10} fill="var(--ember)" />
            </svg>
          : <svg width={10} height={10} viewBox="0 0 10 10">
              <polygon points="1,0 10,5 1,10" fill="var(--ember)" />
            </svg>
        }
      </button>

      {/* Progress bar */}
      <div style={{ flex: 1 }}>
        <div
          onClick={seek}
          style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', cursor: 'pointer', position: 'relative' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--ember)', borderRadius: 2, transition: 'width .1s' }} />
        </div>
      </div>

      {/* Time */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.46rem', color: 'var(--muted)', flexShrink: 0 }}>
        {fmt(current)} / {fmt(duration)}
      </span>

      {/* Label */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.44rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
        Voice
      </span>
    </div>
  )
}
