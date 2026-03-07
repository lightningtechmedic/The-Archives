'use client'

import { useState, useEffect, useRef } from 'react'
import { PATTERNS } from '@/lib/patternSVGs'

const THOUGHTS = [
  'reading patterns...',
  'something is forming...',
  'cross-referencing...',
  'the archive remembers...',
  'signal detected...',
  'watching...',
]

function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('echo-btn-kf')) return
  const s = document.createElement('style')
  s.id = 'echo-btn-kf'
  s.textContent = [
    '@keyframes echoGlyphIdle{0%,100%{opacity:.35}50%{opacity:.7}}',
    '@keyframes echoGlyphFast{0%,100%{opacity:.5}50%{opacity:1}}',
    '@keyframes echoThoughtFade{0%{opacity:0;transform:translateY(4px)}12%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateY(-4px)}}',
    '@keyframes echoTopbarSweep{0%{background-position:-200% 0}100%{background-position:300% 0}}',
    '@keyframes echoAvatarPip{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.5);opacity:1}}',
    '@keyframes echoAvatarGlow{0%,100%{box-shadow:0 0 0 1px rgba(138,180,200,.2),0 0 8px rgba(138,180,200,.08)}50%{box-shadow:0 0 0 1px rgba(138,180,200,.45),0 0 14px rgba(138,180,200,.2)}}',
    '@keyframes echoQPulse{0%,100%{opacity:.3}50%{opacity:.9}}',
  ].join('')
  document.head.appendChild(s)
}

// ── EchoButton ─────────────────────────────────────────────────────────────────
// hasImpression  — true when Echo has produced insight text
// impressionText — the insight text from triggerEchoBackground
// impressionTime — formatted time string ("2:34 PM")
// isPersonal     — true when on a personal note (no active enclave)
// buildCount     — number of builds in pattern library (for footer)
// onPulseAll     — () => void, calls pulseAgent for all 7 agents
// onOpenOverlay  — () => void, called when avatar indicator is clicked
export default function EchoButton({
  hasImpression = false,
  impressionText = '',
  impressionTime = null,
  isPersonal = false,
  buildCount = 0,
  onPulseAll,
  topConcepts = [],
  avatarPattern = null,
  avatarEmote = 'neutral',
  onOpenOverlay,
}) {
  const [open, setOpen] = useState(false)
  const [floatThought, setFloatThought] = useState(null)
  const [rippleActive, setRippleActive] = useState(false)
  const [reading, setReading] = useState(false)
  const [renderedText, setRenderedText] = useState('')
  const [showShimmer, setShowShimmer] = useState(false)

  const panelRef = useRef(null)
  const btnRef = useRef(null)
  const thoughtIdxRef = useRef(0)
  const streamRef = useRef(null)
  const streamedTextRef = useRef('')

  const hasAvatar = !!avatarPattern
  const patternSvg = hasAvatar ? PATTERNS[avatarPattern]?.[avatarEmote || 'neutral'] : null

  useEffect(() => { injectStyles() }, [])

  // ── Idle glyph ripple every 20–30s ──
  useEffect(() => {
    let id
    function schedule() {
      id = setTimeout(() => {
        setRippleActive(true)
        setTimeout(() => setRippleActive(false), 600)
        schedule()
      }, 20000 + Math.random() * 10000)
    }
    schedule()
    return () => clearTimeout(id)
  }, [])

  // ── Floating thought every 45–60s ──
  useEffect(() => {
    let id
    function schedule() {
      id = setTimeout(() => {
        const idx = thoughtIdxRef.current % THOUGHTS.length
        thoughtIdxRef.current++
        setFloatThought(THOUGHTS[idx])
        setTimeout(() => setFloatThought(null), 2000)
        schedule()
      }, 45000 + Math.random() * 15000)
    }
    schedule()
    return () => clearTimeout(id)
  }, [])

  // ── Click outside closes panel ──
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (panelRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // ── Word-by-word streaming when panel opens with a fresh impression ──
  useEffect(() => {
    if (!open || !hasImpression || !impressionText) return
    if (streamedTextRef.current === impressionText) return

    clearInterval(streamRef.current)
    streamedTextRef.current = impressionText
    setRenderedText('')
    setReading(true)
    setShowShimmer(true)
    setTimeout(() => setShowShimmer(false), 1200)
    onPulseAll?.()

    const words = impressionText.split(' ')
    let i = 0
    streamRef.current = setInterval(() => {
      if (i >= words.length) {
        clearInterval(streamRef.current)
        setReading(false)
        setTimeout(() => {
          setFloatThought('done.')
          setTimeout(() => setFloatThought(null), 1400)
        }, 300)
        return
      }
      setRenderedText(prev => prev ? prev + ' ' + words[i] : words[i])
      i++
    }, 55)

    return () => clearInterval(streamRef.current)
  }, [open, hasImpression, impressionText]) // eslint-disable-line

  function handleClick() {
    const wasOpen = open
    if (wasOpen) {
      setRippleActive(true)
      setTimeout(() => setRippleActive(false), 600)
      if (hasImpression) {
        setFloatThought('pattern saved...')
        setTimeout(() => setFloatThought(null), 1500)
      }
    }
    setOpen(v => !v)
  }

  function handleAvatarClick(e) {
    e.stopPropagation()
    setOpen(false)
    onOpenOverlay?.()
  }

  const glyphAnim = reading ? 'echoGlyphFast 1.5s ease-in-out infinite' : 'echoGlyphIdle 4s ease-in-out infinite'

  return (
    <>
      <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '.35rem' }}>

        {/* Topbar shimmer */}
        {showShimmer && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 40,
            pointerEvents: 'none', zIndex: 499, overflow: 'hidden',
            backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(138,180,200,.06) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'echoTopbarSweep 1.2s ease-out forwards',
          }} />
        )}

        {/* Floating thought */}
        {floatThought && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)', fontSize: '.4rem', letterSpacing: '.1em',
            color: 'rgba(138,180,200,.65)',
            animation: 'echoThoughtFade 2s ease-in-out forwards',
            pointerEvents: 'none', zIndex: 10,
          }}>
            {floatThought}
          </div>
        )}

        {/* ── Avatar indicator ── */}
        <div
          onClick={handleAvatarClick}
          title={hasAvatar ? `${avatarPattern}${avatarName ? ' · ' + avatarName : ''}` : 'Create your avatar'}
          style={{ position: 'relative', cursor: 'none', flexShrink: 0 }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 5,
            background: 'rgba(138,180,200,.06)',
            border: `1px solid ${hasAvatar ? 'rgba(138,180,200,.25)' : 'rgba(138,180,200,.12)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            animation: hasAvatar ? 'echoAvatarGlow 4s ease-in-out infinite' : undefined,
            transition: 'border-color .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(138,180,200,.5)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = hasAvatar ? 'rgba(138,180,200,.25)' : 'rgba(138,180,200,.12)'}
          >
            {hasAvatar && patternSvg ? (
              <div
                style={{ width: 26, height: 26 }}
                dangerouslySetInnerHTML={{ __html: patternSvg }}
              />
            ) : (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '.7rem', fontWeight: 700,
                color: 'rgba(138,180,200,.55)',
                animation: 'echoQPulse 2.5s ease-in-out infinite',
              }}>?</span>
            )}
          </div>

          {/* Notification pip — only when no avatar */}
          {!hasAvatar && (
            <div style={{
              position: 'absolute', top: -2, right: -2,
              width: 5, height: 5, borderRadius: '50%',
              background: '#8ab4c8',
              animation: 'echoAvatarPip 2s ease-in-out infinite',
            }} />
          )}
        </div>

        {/* ── The ∿ button ── */}
        <button
          ref={btnRef}
          onClick={handleClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '.35rem',
            background: open ? 'rgba(138,180,200,.06)' : 'transparent',
            border: `1px solid ${open ? 'rgba(138,180,200,.28)' : 'rgba(138,180,200,.14)'}`,
            borderRadius: 6, padding: '.18rem .52rem',
            cursor: 'none', transition: 'background .2s, border-color .2s',
          }}
          onMouseEnter={e => { if (!open) e.currentTarget.style.borderColor = 'rgba(138,180,200,.28)' }}
          onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'rgba(138,180,200,.14)' }}
        >
          <span style={{
            fontSize: '1.05rem', lineHeight: 1, color: '#8ab4c8',
            display: 'inline-block',
            animation: glyphAnim,
            transform: rippleActive ? 'scale(1.18)' : 'scale(1)',
            transition: 'transform 0.3s ease-out',
          }}>∿</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '.44rem',
            letterSpacing: '.12em', color: '#8ab4c8',
            opacity: open ? 1 : 0.75,
          }}>Echo</span>
          {hasImpression && (
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: '#8ab4c8', opacity: 0.7, flexShrink: 0,
              animation: 'pulseSlow 2.5s ease-in-out infinite',
            }} />
          )}
        </button>

        {/* ── Impression Panel ── */}
        {open && (
          <div ref={panelRef} style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 260, zIndex: 600,
            background: 'rgba(13,12,10,.92)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(138,180,200,.14)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            overflow: 'hidden',
          }}>

            {!hasImpression ? (
              /* ── No impression yet ── */
              <div style={{ padding: '1.4rem 1.1rem', textAlign: 'center' }}>
                <span style={{
                  display: 'block', fontSize: '2rem', color: '#8ab4c8',
                  animation: 'echoGlyphIdle 4s ease-in-out infinite',
                  marginBottom: '.85rem',
                }}>∿</span>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: '.92rem', color: 'var(--text)', margin: '0 0 .65rem',
                }}>Echo is listening</h3>
                <p style={{
                  fontFamily: 'var(--font-prose)', fontStyle: 'italic',
                  fontSize: '.82rem', color: 'var(--muted)',
                  lineHeight: 1.7, margin: '0 0 1rem',
                }}>
                  Keep thinking out loud. When there&apos;s enough to read,
                  she&apos;ll tell you what she sees.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '.45rem' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 4, height: 4, borderRadius: '50%',
                      background: '#8ab4c8', display: 'inline-block',
                      animation: `pulseSlow 1.4s ease-in-out ${(i * 0.28).toFixed(2)}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            ) : (
              /* ── Impression exists ── */
              <>
                {/* Header */}
                <div style={{
                  padding: '.6rem .85rem .5rem',
                  borderBottom: '1px solid rgba(138,180,200,.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <span style={{
                      fontSize: '.9rem', color: '#8ab4c8',
                      animation: glyphAnim,
                    }}>∿</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '.44rem',
                      letterSpacing: '.12em', color: '#8ab4c8', textTransform: 'uppercase',
                    }}>Echo</span>
                  </div>
                  {impressionTime && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '.38rem',
                      color: 'var(--muted)', letterSpacing: '.06em',
                    }}>
                      last read · {impressionTime}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '.8rem .85rem .65rem', maxHeight: 200, overflowY: 'auto' }}>
                  <p style={{
                    fontFamily: 'var(--font-prose)', fontStyle: 'italic',
                    fontSize: '.88rem', color: 'rgba(255,248,238,.72)',
                    lineHeight: 1.82, margin: 0, whiteSpace: 'pre-wrap',
                  }}>
                    {renderedText}
                    {reading && (
                      <span style={{
                        opacity: 0.6, marginLeft: 1,
                        animation: 'pulseSlow 0.9s ease-in-out infinite',
                      }}>▋</span>
                    )}
                  </p>
                </div>

                {/* Concept chips */}
                {topConcepts.length > 0 && (
                  <div style={{
                    padding: '.35rem .85rem .4rem',
                    borderTop: '1px solid rgba(138,180,200,.06)',
                    display: 'flex', flexWrap: 'wrap', gap: '.3rem',
                  }}>
                    {topConcepts.map((concept, i) => (
                      <span key={i} style={{
                        fontFamily: 'var(--font-mono)', fontSize: '.36rem',
                        letterSpacing: '.08em',
                        color: 'rgba(138,180,200,.7)',
                        background: 'rgba(138,180,200,.07)',
                        border: '1px solid rgba(138,180,200,.14)',
                        borderRadius: 4,
                        padding: '.15rem .4rem',
                      }}>{concept}</span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div style={{
                  padding: '.4rem .85rem .6rem',
                  borderTop: '1px solid rgba(138,180,200,.06)',
                  display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '.38rem',
                    color: 'var(--muted)', letterSpacing: '.06em', opacity: .5,
                  }}>via neuron snapshot</span>
                  {!isPersonal && buildCount > 0 && (
                    <>
                      <span style={{ color: 'var(--muted)', opacity: .28 }}>·</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '.38rem',
                        color: 'var(--muted)', letterSpacing: '.06em', opacity: .5,
                      }}>archive: {buildCount} builds read</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

    </>
  )
}
