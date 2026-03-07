'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { PATTERNS, EMOTE_NAMES, PATTERN_VOICE } from '@/lib/patternSVGs'

// ── Echo concentric rings face ────────────────────────────────────────────────
function EchoFace({ size = 'large' }) {
  const configs = {
    large: { rings: [76, 56, 38, 22, 10], opacities: [.05, .12, .26, .50, .85], speeds: ['30s', '20s reverse', '13s', '8s reverse', '5s'], core: 5 },
    medium: { rings: [54, 40, 27, 16, 7], opacities: [.05, .12, .26, .50, .85], speeds: ['30s', '20s reverse', '13s', '8s reverse', '5s'], core: 4 },
    small: { rings: [32, 24, 16, 9, 4], opacities: [.05, .12, .26, .50, .85], speeds: ['30s', '20s reverse', '13s', '8s reverse', '5s'], core: 2.5 },
    mini: { rings: [20, 15, 10, 6, 3], opacities: [.05, .12, .26, .50, .85], speeds: ['30s', '20s reverse', '13s', '8s reverse', '5s'], core: 2 },
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
          animation: `echoRingRotate ${c.speeds[i]} linear infinite`,
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
        animation: 'echoCorePulse 2s ease-in-out infinite',
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
      <EchoFace size="mini" />
      <div style={{
        fontFamily: "'Lora', 'Georgia', serif",
        fontStyle: 'italic',
        fontSize: '.92rem',
        color: 'rgba(255,248,238,.6)',
        lineHeight: 1.72,
        paddingTop: 2,
      }}>
        {loading ? (
          <span style={{ opacity: .5, animation: 'echoPulse 1.2s ease-in-out infinite' }}>
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

  // Stage 2 processing
  const [processingStep, setProcessingStep] = useState(0)
  const [assignResult, setAssignResult] = useState(null)

  // Stage 3 avatar result
  const [selectedPattern, setSelectedPattern] = useState(null)
  const [selectedEmote, setSelectedEmote] = useState('neutral')
  const [avatarNameInput, setAvatarNameInput] = useState(initialAvatarName || '')
  const [saving, setSaving] = useState(false)

  const textarea1Ref = useRef(null)
  const textarea2Ref = useRef(null)

  // ── Inject keyframes once ──
  useEffect(() => {
    if (document.getElementById('echo-overlay-kf')) return
    const s = document.createElement('style')
    s.id = 'echo-overlay-kf'
    s.textContent = [
      '@keyframes echoRingRotate{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}',
      '@keyframes echoCorePulse{0%,100%{box-shadow:0 0 6px 2px rgba(138,180,200,.5)}50%{box-shadow:0 0 10px 4px rgba(138,180,200,.8)}}',
      '@keyframes echoPulse{0%,100%{opacity:.3}50%{opacity:.8}}',
      '@keyframes echoFu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes echoAvReveal{0%{transform:scale(.3);opacity:0;filter:blur(16px)}100%{transform:scale(1);opacity:1;filter:blur(0)}}',
      '@keyframes echoOrbit{from{transform:rotate(0deg) translateX(44px) rotate(0deg)}to{transform:rotate(360deg) translateX(44px) rotate(-360deg)}}',
      '@keyframes echoOrbitRev{from{transform:rotate(360deg) translateX(52px) rotate(-360deg)}to{transform:rotate(0deg) translateX(52px) rotate(0deg)}}',
      '@keyframes echoAvatarGlow{0%,100%{box-shadow:0 0 0 1px rgba(138,180,200,.35),0 0 20px rgba(138,180,200,.15)}50%{box-shadow:0 0 0 1px rgba(138,180,200,.6),0 0 30px rgba(138,180,200,.3)}}',
      '@keyframes echoPip{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.4);opacity:1}}',
      '@keyframes echoStepFu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
    ].join('')
    document.head.appendChild(s)
  }, [])

  // ── Escape to close ──
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
      setBeat2Text(data.text || 'And when you see it — what do you do with it?')
    } catch {
      setBeat2Text('And when you see it — what do you do with it?')
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

    // Kick off API call immediately
    const apiPromise = fetch('/vault/api/echo/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer1, answer2 }),
    }).then(r => r.json())

    // Reveal steps
    for (let i = 0; i < STEPS.length; i++) {
      await new Promise(r => setTimeout(r, delays[i]))
      setProcessingStep(i + 1)
    }

    // Wait for API
    const result = await apiPromise
    setAssignResult(result)
    setSelectedPattern(result.pattern)
    setSelectedEmote('neutral')

    // Small pause after last step before reveal
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
      position: 'fixed', inset: 0, zIndex: 9800,
      background: 'rgba(8,7,6,.94)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>

      {/* Content area */}
      <div style={{
        opacity: stageFade ? 1 : 0,
        transition: 'opacity .22s cubic-bezier(0.16,1,0.3,1)',
        width: '100%',
        maxWidth: stage === '3' ? 760 : 520,
        padding: '0 24px',
      }}>

        {/* ── Stage 0 — First time ── */}
        {stage === '0' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
            <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .2s both' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(138,180,200,.5)', marginBottom: '1.8rem', textTransform: 'uppercase' }}>
                Echo · Pattern Intelligence
              </div>
              <EchoFace size="large" />
            </div>

            <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .5s both' }}>
              <p style={{
                fontFamily: "'Lora', 'Georgia', serif",
                fontStyle: 'italic',
                fontSize: '1.15rem',
                color: 'rgba(255,248,238,.55)',
                lineHeight: 1.8,
                margin: 0,
                maxWidth: 380,
              }}>
                I read patterns.<br />
                In conversations, in thinking,<br />
                in what&apos;s said and what&apos;s{' '}
                <span style={{ color: 'rgba(255,248,238,.88)', fontStyle: 'normal', fontWeight: 400 }}>meant</span>.
                <br />
                Let me make you something from yours.
              </p>
            </div>

            <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .9s both' }}>
              <GhostButton onClick={() => goToStage('1')}>I&apos;m ready →</GhostButton>
            </div>
          </div>
        )}

        {/* ── Stage 0B — Return visit ── */}
        {stage === '0B' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', textAlign: 'center' }}>
            <div style={{ animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .2s both' }}>
              {/* Current avatar with glow */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  border: '1px solid rgba(138,180,200,.35)',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'echoAvatarGlow 3s ease-in-out infinite',
                  background: 'rgba(138,180,200,.04)',
                }}>
                  <PatternAvatar pattern={avatarPattern} emote={initialAvatarEmote || 'neutral'} size={68} />
                </div>
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
                Is there something{' '}
                <span style={{ color: 'rgba(255,248,238,.88)', fontStyle: 'normal' }}>different</span>{' '}
                about you?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', animation: 'echoFu .5s cubic-bezier(0.16,1,0.3,1) .6s both' }}>
              <GhostButton onClick={onClose}>Not really</GhostButton>
              <EchoButton onClick={() => goToStage('1')}>Something has changed</EchoButton>
            </div>
          </div>
        )}

        {/* ── Stage 1 — Two-beat conversation ── */}
        {stage === '1' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Beat 1 */}
            <div style={{ animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .1s both' }}>
              <EchoMsg text="Tell me what you notice that others don't." />
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
                {/* User's answer 1 */}
                <UserMsg text={answer1} />

                {/* Beat 2 */}
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

            {/* Left: avatar + name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              {/* Avatar with orbit rings */}
              <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                {/* Orbit rings */}
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

                {/* Avatar circle */}
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
                <EchoButton onClick={handleSave} disabled={saving} fullWidth>
                  {saving ? 'Saving...' : 'Set my avatar →'}
                </EchoButton>
                <GhostButton onClick={handleRetry} fullWidth>
                  ↺ ask Echo again
                </GhostButton>
              </div>
            </div>

            {/* Right: observation + emote picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Echo observation */}
              {assignResult?.observation && (
                <div style={{ animation: 'echoFu .4s cubic-bezier(0.16,1,0.3,1) .6s both' }}>
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
                        letterSpacing: '.08em', color: selectedEmote === emote ? '#8ab4c8' : 'rgba(255,248,238,.3)',
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

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: 'none', border: 'none',
          color: 'rgba(255,248,238,.2)', fontSize: '1.2rem',
          cursor: 'none', transition: 'color .15s', lineHeight: 1, padding: '4px 6px',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,248,238,.6)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,248,238,.2)'}
      >
        ×
      </button>
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

function EchoButton({ children, onClick, disabled = false, fullWidth = false }) {
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
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = 'rgba(138,180,200,.18)'
      }}
      onMouseLeave={e => {
        if (!disabled) e.currentTarget.style.background = 'rgba(138,180,200,.1)'
      }}
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

import { forwardRef } from 'react'
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
        <EchoButton onClick={onSend} disabled={!value.trim()}>
          Send →
        </EchoButton>
      </div>
    </div>
  )
})
