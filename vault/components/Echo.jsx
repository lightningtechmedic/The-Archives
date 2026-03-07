'use client'

import { useEffect } from 'react'

// Organic double-wave path — asymmetric, continuous, folds back on itself
const WAVE_PATH = 'M 4,15 C 10,2 20,28 30,15 C 40,2 50,28 56,15'
const DASH_LEN = 90

export function EchoWave({ mood = 'idle', size = 40 }) {
  useEffect(() => {
    if (document.getElementById('echo-kf')) return
    const s = document.createElement('style')
    s.id = 'echo-kf'
    s.textContent = [
      '@keyframes echoWaveFlow{0%{stroke-dashoffset:0;opacity:.7}50%{stroke-dashoffset:-45;opacity:1}100%{stroke-dashoffset:-90;opacity:.7}}',
      '@keyframes echoWaveFast{0%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-45;opacity:1}}',
      '@keyframes echoThinkPulse{0%,100%{stroke-dasharray:6,4;opacity:.45}50%{stroke-dasharray:2,8;opacity:.75}}',
      '@keyframes echoRipple{0%{r:4;opacity:.4}100%{r:20;opacity:0}}',
    ].join('')
    document.head.appendChild(s)
  }, [])

  const w = Math.round((size / 30) * 60)
  const h = size

  const isThinking = mood === 'thinking'

  let pathStyle = { fill: 'none', stroke: '#8ab4c8', strokeWidth: 1.5 }
  if (mood === 'idle') {
    pathStyle = { ...pathStyle, strokeDasharray: DASH_LEN, animation: 'echoWaveFlow 4s ease-in-out infinite' }
  } else if (mood === 'thinking') {
    pathStyle = { ...pathStyle, animation: 'echoThinkPulse 0.8s ease-in-out infinite' }
  } else if (mood === 'insight') {
    pathStyle = { ...pathStyle, strokeDasharray: DASH_LEN, animation: 'echoWaveFast 2s linear infinite', opacity: 1 }
  } else if (mood === 'delighted') {
    pathStyle = {
      ...pathStyle, strokeDasharray: DASH_LEN,
      animation: 'echoWaveFlow 1.5s ease-in-out infinite',
      filter: 'drop-shadow(0 0 6px #8ab4c844)',
    }
  }

  return (
    <div style={{
      display: 'inline-block', width: w, height: h, flexShrink: 0,
      transform: isThinking ? 'scaleY(0.15)' : 'scaleY(1)',
      transition: 'transform 0.6s ease-in-out',
      transformOrigin: 'center',
    }}>
      <svg width={w} height={h} viewBox="0 0 60 30" style={{ display: 'block', overflow: 'visible' }}>
        <path d={WAVE_PATH} style={pathStyle} />
        {mood === 'delighted' && [0, 1, 2].map(i => (
          <circle key={i} cx={30} cy={15} r={4}
            fill="none" stroke="#8ab4c8" strokeWidth={0.8}
            style={{ animation: `echoRipple 0.8s ease-out ${i * 150}ms infinite` }} />
        ))}
      </svg>
    </div>
  )
}
