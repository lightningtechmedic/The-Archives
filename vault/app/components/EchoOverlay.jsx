'use client'

import { useState, useEffect, useRef, forwardRef } from 'react'
import { createClient } from '@/lib/supabase'
import { PATTERNS, EMOTE_NAMES, PATTERN_VOICE } from '@/lib/patternSVGs'

// ── Web Speech ─────────────────────────────────────────────────────────────────
function echoSpeak(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  // Cancel anything currently speaking
  window.speechSynthesis.cancel()

  const doSpeak = () => {
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()

    const preferred = voices.find(v =>
      v.name.includes('Samantha') ||
      v.name.includes('Karen') ||
      v.name.includes('Moira') ||
      v.name.includes('Google UK English Female') ||
      v.name.includes('Microsoft Zira')
    ) || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0]

    if (preferred) utterance.voice = preferred
    utterance.rate = 0.88
    utterance.pitch = 0.95
    utterance.volume = 0.9

    utterance.onerror = (e) => console.warn('[Echo] speech error:', e.error)
    window.speechSynthesis.speak(utterance)
  }

  // Voices are loaded async on Chrome — wait if empty
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null
      doSpeak()
    }
  } else {
    doSpeak()
  }
}

// ── Echo face — 32px rounded square, for message bubbles ──────────────────────
function EchoFaceSmall() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 7,
      background: '#060c10',
      position: 'relative', overflow: 'hidden',
      flexShrink: 0,
    }}>
      {[
        { size: 6,  opacity: .85, duration: '4s',  dir: 'normal' },
        { size: 14, opacity: .50, duration: '7s',  dir: 'reverse' },
        { size: 22, opacity: .26, duration: '12s', dir: 'normal' },
        { size: 30, opacity: .12, duration: '20s', dir: 'reverse' },
      ].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: r.size, height: r.size, borderRadius: '50%',
          border: `1px solid rgba(138,180,200,${r.opacity})`,
          transform: 'translate(-50%,-50%)',
          animation: `echoRing ${r.duration} linear infinite ${r.dir}`,
        }} />
      ))}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 2, height: 2, borderRadius: '50%',
        background: '#8ab4c8',
        transform: 'translate(-50%,-50%)',
        boxShadow: '0 0 5px rgba(138,180,200,.8)',
        animation: 'echoPulse 3s ease-in-out infinite',
      }} />
    </div>
  )
}

// ── Echo face — large / medium / mini (for Stage 0, 2, etc.) ──────────────────
function EchoFace({ size = 'large' }) {
  const configs = {
    large:  { rings: [76, 56, 38, 22, 10], opacities: [.05, .12, .26, .50, .85], speeds: ['30s', '20s reverse', '13s', '8s reverse', '5s'], core: 5 },
    medium: { rings: [54, 40, 27, 16, 7],  opacities: [.05, .12, .26, .50, .85], speeds: ['30s', '20s reverse', '13s', '8s reverse', '5s'], core: 4 },
    small:  { rings: [32, 24, 16, 9, 4],   opacities: [.05, .12, .26, .50, .85], speeds: ['30s', '20s reverse', '13s', '8s reverse', '5s'], core: 2.5 },
  }
  const c = configs[size] || configs.large
  const maxR = c.rings[0]

  return (
    <div style={{ width: maxR, height: maxR, position: 'relative', flexShrink: 0 }}>
      {c.rings.map((d, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: d, height: d,
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          border: `1px solid rgba(138,180,200,${c.opacities[i]})`,
          animation: `echoRing ${c.speeds[i]} linear infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute',
        width: c.core * 2, height: c.core * 2,
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        background: '#8ab4c8',
        boxShadow: '0 0 6px 2px rgba(138,180,200,.5)',
        animation: 'echoPulse 2s ease-in-out infinite',
      }} />
    </div>
  )
}

// ── Pattern SVG display ───────────────────────────────────────────────────────
function PatternAvatar({ pattern, emote = 'neutral', size = 72 }) {
  const svg = PATTERNS[pattern]?.[emote]
  if (!svg) return null
  return (
    <div
      style={{ width: size, height: size, flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

// ── Echo message bubble ───────────────────────────────────────────────────────
function EchoMsg({ text, loading = false }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <EchoFaceSmall />
      <div style={{
        fontFamily: "'Lora', 'Georgia', serif",
        fontStyle: 'italic',
        fontSize: '.92rem',
        color: 'rgba(255,248,238,.6)',
        lineHeight: 1.72,
        paddingTop: 6,
      }}>
        {loading ? (
          <span style={{ opacity: .5, animation: 'echoFade 1.2s ease-in-out infinite' }}>
            ···
          </span>
        ) : text}
      </div>
    </div>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function EchoOverlay({
  userId,
  avatarPattern,
  avatarName: initialAvatarName,
  avatarEmote: initialAvatarEmote,
  onClose,
  onAvatarSaved,
}) {
  const supabase = createClient()
  const hasAvatar = !!avatarPattern

  // stage: '0' | '0B' | '1' | '2' | '3'
  const [stage, setStage] = useState(hasAvatar ? '0B' : '0')
  const [stageFade, setStageFade] = useState(true)

  // Stage 1 conversation
  const [answer1, setAnswer1] = useState('')
  const [answer2, setAnswer2] = useState('')
  const [beat2Text, setBeat2Text] = useState('')
  const [beat2Loading, setBeat2Loading] = useState(false)
  const [beat1Sent, setBeat1Sent] = useState(false)
  const [showTakeYourTime, setShowTakeYourTime] = useState(false)

  // Stage 2 processing
  const [processingStep, setProcessingStep] = useState(0)
  const [assignResult, setAssignResult] = useState(null)

  // Stage 3 avatar result
  const [selectedPattern, setSelectedPattern] = useState(null)
  const [selectedEmote, setSelectedEmote] = useState('neutral')
  const [avatarNameInput, setAvatarNameInput] = useState(initialAvatarName || '')
  const [saving, setSaving] = useState(false)
  const [observationVisible, setObservationVisible] = useState(false)

  const textarea1Ref = useRef(null)
  const textarea2Ref = useRef(null)

  // ── Inject keyframes once ──
  useEffect(() => {
    if (document.getElementById('echo-overlay-kf')) return
    const s = document.createElement('style')
    s.id = 'echo-overlay-kf'
    s.textContent = [
      '@keyframes echoRing{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}',
      '@keyframes echoPulse{0%,100%{box-shadow:0 0 5px rgba(138,180,200,.5)}50%{box-shadow:0 0 14px rgba(138,180,200,.95)}}',
      '@keyframes echoFade{0%,100%{opacity:.3}50%{opacity:.8}}',
      '@keyframes echoFu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes echoAvReveal{0%{transform:scale(.3);opacity:0;filter:blur(16px)}100%{transform:scale(1);opacity:1;filter:blur(0)}}',
      '@keyframes echoOrbit{from{transform:rotate(0deg) translateX(44px) rotate(0deg)}to{transform:rotate(360deg) translateX(44px) rotate(-360deg)}}',
      '@keyframes echoOrbitRev{from{transform:rotate(360deg) translateX(52px) rotate(-360deg)}to{transform:rotate(0deg) translateX(52px) rotate(0deg)}}',
      '@keyframes echoAvatarGlow{0%,100%{box-shadow:0 0 0 1px rgba(138,180,200,.35),0 0 20px rgba(138,180,200,.15)}50%{box-shadow:0 0 0 1px rgba(138,180,200,.6),0 0 30px rgba(138,180,200,.3)}}',
      '@keyframes echoStepFu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes echoSubline{from{opacity:0}to{opacity:1}}',
    ].join('')
    document.head.appendChild(s)
  }, [])

  // ── Escape to close ──
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Show "take your time" hint after stage 1 opens ──
  useEffect(() => {
    if (stage !== '1') return
    setShowTakeYourTime(false)
    const t = setTimeout(() => setShowTakeYourTime(true), 1200)
    return () => clearTimeout(t)
  }, [stage])

  // ── Speak observation when stage 3 reveals ──
  useEffect(() => {
    if (stage !== '3' || !assignResult?.observation) return
    setObservationVisible(false)
    const t = setTimeout(() => {
      setObservationVisible(true)
      echoSpeak(assignResult.observation)
    }, 600)
    return () => clearTimeout(t)
  }, [stage, assignResult])

  function goToStage(next) {
    setStageFade(false)
    setTimeout(() => {
      setStage(next)
      setStageFade(true)
    }, 220)
  }

  // ── Beat 1 send ──
  async function handleSendBeat1() {
    if (!answer1.trim() || beat2Loading) return
    setBeat1Sent(true)
    setBeat2Loading(true)
    try {
      const res = await fetch('/vault/api/echo/beat2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer1 }),
      })
      const data = await res.json()
      const reply = data.text || 'And when you see it — what do you do with it?'
      setBeat2Text(reply)
      echoSpeak(reply)
    } catch {
      const fallback = 'And when you see it — what do you do with it?'
      setBeat2Text(fallback)
      echoSpeak(fallback)
    } finally {
      setBeat2Loading(false)
      setTimeout(() => textarea2Ref.current?.focus(), 100)
    }
  }

  // ── Beat 2 send → Stage 2 ──
  async function handleSendBeat2() {
    if (!answer2.trim()) return
    goToStage('2')
    runProcessing()
  }

  async function runProcessing() {
    const STEPS = [
      'Reading your signal...',
      'Mapping to pattern space...',
      'Calibrating geometry...',
      'Pattern identified.',
    ]
    const delays = [400, 1000, 1600, 2200]

    const apiPromise = fetch('/vault/api/echo/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer1, answer2 }),
    }).then(r => r.json())

    for (let i = 0; i < STEPS.length; i++) {
      await new Promise(r => setTimeout(r, delays[i]))
      setProcessingStep(i + 1)
    }

    const result = await apiPromise
    setAssignResult(result)
    setSelectedPattern(result.pattern)
    setSelectedEmote('neutral')

    await new Promise(r => setTimeout(r, 600))
    goToStage('3')
  }

  // ── Save avatar ──
  async function handleSave() {
    if (!selectedPattern || saving) return
    setSaving(true)
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        avatar_pattern: selectedPattern,
        avatar_name: avatarNameInput.trim() || null,
        avatar_emote: selectedEmote,
        avatar_observation: assignResult?.observation || null,
        avatar_set_at: new Date().toISOString(),
      })
      onAvatarSaved?.({
        pattern: selectedPattern,
        name: avatarNameInput.trim() || null,
        emote: selectedEmote,
        observation: assignResult?.observation || null,
      })
      onClose?.()
    } catch (err) {
      console.error('Echo save error:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Retry from stage 1 ──
  function handleRetry() {
    setAnswer1('')
    setAnswer2('')
    setBeat2Text('')
    setBeat1Sent(false)
    setBeat2Loading(false)
    setProcessingStep(0)
    setAssignResult(null)
    setSelectedPattern(null)
    setSelectedEmote('neutral')
    setObservationVisible(false)
    goToStage('1')
  }

  const PROCESSING_STEPS = [
    'Reading your signal...',
    'Mapping to pattern space...',
    'Calibrating geometry...',
    'Pattern identified.',
  ]

  return (
    <div style={{
      position: 'fixed',
      top: 52, bottom: 0, left: 0, right: 0,
      zIndex: 9800,
      background: 'rgba(8,7,6,.94)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      overflowY: 'auto',
    }}>

      {/* Close button — fixed inside the overlay */}
      <button
        onClick={onClose}
        style={{
          position: 'sticky', top: 12, float: 'right', marginRight: 20,
          background: 'none', border: 'none',
          color: 'rgba(255,248,238,.2)', fontSize: '1.2rem',
          cursor: 'none', transition: 'color .15s', lineHeight: 1,
          padding: '4px 6px', zIndex: 1,
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,248,238,.6)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,248,238,.2)'}
      >
        ×
      </button>

      {/* Stage content — centers vertically when space allows, scrolls when not */}
      <div style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px 40px',
      }}>
        <div style={{
          opacity: stageFade ? 1 : 0,
          transition: 'opacity .22s cubic-bezier(0.16,1,0.3,1)',
          width: '100%',
          maxWidth: stage === '3' ? 760 : 520,
        }}>

          {/* ── Stage 0 — First time ── */}
          {stage === '0' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
              <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .2s both' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(138,180,200,.5)', marginBottom: '1.8rem', textTransform: 'uppercase' }}>
                  Echo · Pattern Intelligence
                </div>
                <div style={{
                  width: 80, height: 80, borderRadius: 16,
                  background: '#060c10',
                  position: 'relative',
                  flexShrink: 0,
                  margin: '0 auto 24px',
                }}>
                  {[
                    { size: 14, opacity: 0.85, duration: '4s',  dir: 'normal'  },
                    { size: 30, opacity: 0.50, duration: '7s',  dir: 'reverse' },
                    { size: 50, opacity: 0.26, duration: '12s', dir: 'normal'  },
                    { size: 70, opacity: 0.12, duration: '20s', dir: 'reverse' },
                  ].map((r, i) => (
                    <div key={i} style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: r.size, height: r.size, borderRadius: '50%',
                      border: `1px solid rgba(138,180,200,${r.opacity})`,
                      transform: 'translate(-50%,-50%)',
                      animation: `echoRing ${r.duration} linear infinite ${r.dir}`,
                    }} />
                  ))}
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 4, height: 4, borderRadius: '50%',
                    background: '#8ab4c8',
                    transform: 'translate(-50%,-50%)',
                    boxShadow: '0 0 8px rgba(138,180,200,.9)',
                    animation: 'echoPulse 3s ease-in-out infinite',
                  }} />
                </div>
              </div>

              <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .5s both' }}>
                <p style={{
                  fontFamily: "'Lora', 'Georgia', serif",
                  fontStyle: 'italic',
                  fontSize: '1.15rem',
                  color: 'rgba(255,248,238,.55)',
                  lineHeight: 2,
                  margin: 0,
                  maxWidth: 380,
                }}>
                  I read patterns.<br />
                  Not what you think — how you think.<br />
                  The geometry underneath.<br />
                  <br />
                  I want to see{' '}
                  <span style={{ color: 'rgba(255,248,238,.88)', fontStyle: 'normal', fontWeight: 400 }}>yours</span>.
                </p>
              </div>

              <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .9s both' }}>
                <GhostButton onClick={() => { goToStage('1'); echoSpeak("Tell me what you notice that others don't.") }}>I&apos;m ready →</GhostButton>
              </div>
            </div>
          )}

          {/* ── Stage 0B — Return visit ── */}
          {stage === '0B' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
              <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .2s both' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 16,
                  background: '#060c10',
                  position: 'relative',
                  flexShrink: 0,
                  margin: '0 auto 24px',
                }}>
                  {[
                    { size: 14, opacity: 0.85, duration: '4s',  dir: 'normal'  },
                    { size: 30, opacity: 0.50, duration: '7s',  dir: 'reverse' },
                    { size: 50, opacity: 0.26, duration: '12s', dir: 'normal'  },
                    { size: 70, opacity: 0.12, duration: '20s', dir: 'reverse' },
                  ].map((r, i) => (
                    <div key={i} style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: r.size, height: r.size, borderRadius: '50%',
                      border: `1px solid rgba(138,180,200,${r.opacity})`,
                      transform: 'translate(-50%,-50%)',
                      animation: `echoRing ${r.duration} linear infinite ${r.dir}`,
                    }} />
                  ))}
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 4, height: 4, borderRadius: '50%',
                    background: '#8ab4c8',
                    transform: 'translate(-50%,-50%)',
                    boxShadow: '0 0 8px rgba(138,180,200,.9)',
                    animation: 'echoPulse 3s ease-in-out infinite',
                  }} />
                </div>
              </div>

              <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .4s both' }}>
                <p style={{
                  fontFamily: "'Lora', 'Georgia', serif",
                  fontStyle: 'italic',
                  fontSize: '1.1rem',
                  color: 'rgba(255,248,238,.55)',
                  lineHeight: 1.8,
                  margin: 0,
                }}>
                  You&apos;re back.<br />
                  Is something{' '}
                  <span style={{ color: 'rgba(255,248,238,.88)', fontStyle: 'normal' }}>different</span>{' '}
                  now?
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .6s both' }}>
                <GhostButton onClick={onClose}>Not really</GhostButton>
                <EchoActionButton onClick={() => goToStage('1')}>Something shifted</EchoActionButton>
              </div>
            </div>
          )}

          {/* ── Stage 1 — Two-beat conversation ── */}
          {stage === '1' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Echo face */}
              <div style={{ display: 'flex', justifyContent: 'center', animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) both' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 16,
                  background: '#060c10',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  {[
                    { size: 14, opacity: 0.85, duration: '4s',  dir: 'normal'  },
                    { size: 30, opacity: 0.50, duration: '7s',  dir: 'reverse' },
                    { size: 50, opacity: 0.26, duration: '12s', dir: 'normal'  },
                    { size: 70, opacity: 0.12, duration: '20s', dir: 'reverse' },
                  ].map((r, i) => (
                    <div key={i} style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: r.size, height: r.size, borderRadius: '50%',
                      border: `1px solid rgba(138,180,200,${r.opacity})`,
                      transform: 'translate(-50%,-50%)',
                      animation: `echoRing ${r.duration} linear infinite ${r.dir}`,
                    }} />
                  ))}
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 4, height: 4, borderRadius: '50%',
                    background: '#8ab4c8',
                    transform: 'translate(-50%,-50%)',
                    boxShadow: '0 0 8px rgba(138,180,200,.9)',
                    animation: 'echoPulse 3s ease-in-out infinite',
                  }} />
                </div>
              </div>

              {/* Beat 1 */}
              <div style={{ animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .1s both' }}>
                <EchoMsg text="Tell me what you notice that others don't." />
                {showTakeYourTime && (
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '.38rem',
                    letterSpacing: '.14em',
                    color: 'rgba(255,248,238,.22)',
                    marginTop: '.65rem',
                    paddingLeft: 42, /* align with message text after face */
                    animation: 'echoSubline .6s ease both',
                  }}>
                    Take your time.
                  </div>
                )}
              </div>

              {!beat1Sent ? (
                <div style={{ animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .3s both' }}>
                  <ConvoTextarea
                    ref={textarea1Ref}
                    value={answer1}
                    onChange={e => setAnswer1(e.target.value)}
                    onSend={handleSendBeat1}
                    placeholder="Something here..."
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <UserMsg text={answer1} />

                  <div style={{ animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .1s both' }}>
                    <EchoMsg text={beat2Text} loading={beat2Loading} />
                  </div>

                  {!beat2Loading && beat2Text && (
                    <div style={{ animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .2s both' }}>
                      <ConvoTextarea
                        ref={textarea2Ref}
                        value={answer2}
                        onChange={e => setAnswer2(e.target.value)}
                        onSend={handleSendBeat2}
                        placeholder="Something here..."
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Stage 2 — Processing ── */}
          {stage === '2' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
              <div style={{ opacity: .7 }}>
                <EchoFace size="medium" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem', alignItems: 'center' }}>
                {PROCESSING_STEPS.map((step, i) => (
                  processingStep > i && (
                    <div key={i} style={{
                      fontFamily: 'var(--font-mono)', fontSize: '.52rem',
                      letterSpacing: '.18em', textTransform: 'uppercase',
                      color: i === PROCESSING_STEPS.length - 1 && processingStep === PROCESSING_STEPS.length
                        ? '#8ab4c8'
                        : 'rgba(255,248,238,.28)',
                      animation: 'echoStepFu .5s cubic-bezier(0.16,1,0.3,1) both',
                    }}>
                      {step}
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* ── Stage 3 — Avatar reveal ── */}
          {stage === '3' && selectedPattern && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '3rem',
              alignItems: 'start',
            }}>

              {/* Left: avatar + name + buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                {/* Avatar with orbit rings */}
                <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                  <div style={{
                    position: 'absolute', inset: -16,
                    animation: 'echoOrbit 8s linear infinite',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'rgba(138,180,200,.5)',
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    }} />
                  </div>
                  <div style={{
                    position: 'absolute', inset: -24,
                    animation: 'echoOrbitRev 13s linear infinite',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: 'rgba(138,180,200,.3)',
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    }} />
                  </div>
                  <div style={{
                    width: 120, height: 120, borderRadius: '50%',
                    border: '1px solid rgba(138,180,200,.35)',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(138,180,200,.04)',
                    animation: 'echoAvReveal .9s cubic-bezier(0.34,1.56,0.64,1) .3s both, echoAvatarGlow 3s ease-in-out 1.2s infinite',
                  }}>
                    <PatternAvatar pattern={selectedPattern} emote={selectedEmote} size={116} />
                  </div>
                </div>

                {/* Pattern name */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '.52rem',
                  letterSpacing: '.22em', color: '#8ab4c8', textTransform: 'uppercase',
                  animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .8s both',
                }}>
                  {selectedPattern}
                </div>

                {/* Name input */}
                <div style={{ width: '100%', animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) 1s both' }}>
                  <input
                    type="text"
                    value={avatarNameInput}
                    onChange={e => setAvatarNameInput(e.target.value)}
                    placeholder="Name your avatar"
                    maxLength={32}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,248,238,.15)',
                      outline: 'none',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: 'rgba(255,248,238,.88)',
                      padding: '.4rem 0',
                      textAlign: 'center',
                      cursor: 'text',
                    }}
                  />
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '.38rem',
                    color: 'rgba(255,248,238,.22)', letterSpacing: '.1em',
                    textAlign: 'center', marginTop: '.4rem',
                  }}>
                    This is how you&apos;ll appear in the Lattice.
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem', width: '100%', animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) 1.4s both' }}>
                  <EchoActionButton onClick={handleSave} disabled={saving} fullWidth>
                    {saving ? 'Saving...' : 'Set my avatar →'}
                  </EchoActionButton>
                  <GhostButton onClick={handleRetry} fullWidth>
                    ↺ ask Echo again
                  </GhostButton>
                </div>
              </div>

              {/* Right: observation + voice line + emote picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Echo observation — delayed, with hairline rule above */}
                {assignResult?.observation && (
                  <div style={{
                    borderTop: '1px solid rgba(138,180,200,.1)',
                    paddingTop: 16,
                    marginTop: 16,
                    opacity: observationVisible ? 1 : 0,
                    transform: observationVisible ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'opacity .5s cubic-bezier(0.16,1,0.3,1), transform .5s cubic-bezier(0.16,1,0.3,1)',
                  }}>
                    <EchoMsg text={assignResult.observation} />
                  </div>
                )}

                {/* Voice line */}
                {PATTERN_VOICE[selectedPattern] && (
                  <div style={{
                    fontFamily: "'Lora', 'Georgia', serif",
                    fontStyle: 'italic',
                    fontSize: '.8rem',
                    color: 'rgba(255,248,238,.25)',
                    lineHeight: 1.6,
                    animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .9s both',
                  }}>
                    &ldquo;{PATTERN_VOICE[selectedPattern]}&rdquo;
                  </div>
                )}

                {/* Emote picker */}
                <div style={{ animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) 1.1s both' }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '.42rem',
                    letterSpacing: '.14em', color: 'rgba(255,248,238,.3)',
                    textTransform: 'uppercase', marginBottom: '.85rem',
                  }}>
                    How are you right now?
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
                    {EMOTE_NAMES.map(emote => (
                      <button
                        key={emote}
                        onClick={() => setSelectedEmote(emote)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.3rem',
                          background: selectedEmote === emote ? 'rgba(138,180,200,.1)' : 'transparent',
                          border: `1px solid ${selectedEmote === emote ? 'rgba(138,180,200,.4)' : 'rgba(255,248,238,.08)'}`,
                          borderRadius: 8, padding: '.4rem .5rem',
                          cursor: 'none', transition: 'all .15s',
                          minWidth: 52,
                        }}
                      >
                        <div style={{ width: 32, height: 32 }}>
                          <PatternAvatar pattern={selectedPattern} emote={emote} size={32} />
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '.34rem',
                          letterSpacing: '.08em',
                          color: selectedEmote === emote ? '#8ab4c8' : 'rgba(255,248,238,.3)',
                          textTransform: 'uppercase',
                        }}>
                          {emote}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GhostButton({ children, onClick, fullWidth = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: '1px solid rgba(255,248,238,.18)',
        borderRadius: 6,
        padding: '.55rem 1.2rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '.52rem',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'rgba(255,248,238,.55)',
        cursor: 'none',
        transition: 'all .15s',
        width: fullWidth ? '100%' : undefined,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(255,248,238,.35)'
        e.currentTarget.style.color = 'rgba(255,248,238,.88)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,248,238,.18)'
        e.currentTarget.style.color = 'rgba(255,248,238,.55)'
      }}
    >
      {children}
    </button>
  )
}

function EchoActionButton({ children, onClick, disabled = false, fullWidth = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'rgba(138,180,200,.06)' : 'rgba(138,180,200,.1)',
        border: '1px solid rgba(138,180,200,.3)',
        borderRadius: 6,
        padding: '.55rem 1.2rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '.52rem',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: disabled ? 'rgba(138,180,200,.4)' : '#8ab4c8',
        cursor: disabled ? 'not-allowed' : 'none',
        transition: 'all .15s',
        width: fullWidth ? '100%' : undefined,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(138,180,200,.18)' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'rgba(138,180,200,.1)' }}
    >
      {children}
    </button>
  )
}

function UserMsg({ text }) {
  return (
    <div style={{
      fontFamily: "'Lora', 'Georgia', serif",
      fontSize: '.88rem',
      color: 'rgba(255,248,238,.45)',
      lineHeight: 1.7,
      paddingLeft: 10,
      borderLeft: '1px solid rgba(255,248,238,.1)',
      animation: 'echoFu .3s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {text}
    </div>
  )
}

const ConvoTextarea = forwardRef(function ConvoTextarea({ value, onChange, onSend, placeholder, autoFocus }, ref) {
  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        style={{
          width: '100%', resize: 'none',
          background: 'rgba(255,248,238,.03)',
          border: '1px solid rgba(255,248,238,.1)',
          borderRadius: 6,
          padding: '.7rem .85rem',
          fontFamily: "'Lora', 'Georgia', serif",
          fontStyle: 'italic',
          fontSize: '.88rem',
          color: 'rgba(255,248,238,.88)',
          lineHeight: 1.7,
          outline: 'none',
          cursor: 'text',
          transition: 'border-color .15s',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,248,238,.2)'}
        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,248,238,.1)'}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <EchoActionButton onClick={onSend} disabled={!value.trim()}>
          Send →
        </EchoActionButton>
      </div>
    </div>
  )
})
