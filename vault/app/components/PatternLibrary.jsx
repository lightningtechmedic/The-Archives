'use client'

import { useState, useEffect, useRef } from 'react'
import ImpressionThumb from '@/components/ImpressionThumb'
import { EchoWave } from '@/components/Echo'
import { agentColors as colors } from '@/lib/agentColors'
import { PATTERNS, PATTERN_LIBRARY_HOVER, PATTERN_LIBRARY_OWN } from '@/lib/patternSVGs'

function formatImpressionDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function computeInsights(impressions) {
  const shapes = impressions.map(i => i.neuron_snapshot.shape || 'open')
  const mostCommon = [...new Set(shapes)]
    .sort((a, b) =>
      shapes.filter(s => s === b).length - shapes.filter(s => s === a).length
    )[0]
  const socraSpeaks = impressions
    .filter(i => i.neuron_snapshot.agentsPresent?.includes('socra')).length
  const avgMessages = Math.round(
    impressions.reduce((s, i) => s + (i.neuron_snapshot.messageCount || 0), 0) /
    impressions.length
  )
  return { mostCommon, socraSpeaks, avgMessages }
}

const SHAPES = ['ALL', 'FOCUSED', 'CONTESTED', 'EXPANSIVE', 'CONVERGING', 'OPEN']

// ── Mini Echo face (20px) ──────────────────────────────────────────────────────
function EchoFaceMini() {
  return (
    <div style={{ width: 20, height: 20, position: 'relative', flexShrink: 0 }}>
      {[20, 14, 9, 5, 3].map((d, i) => (
        <div key={i} style={{
          position: 'absolute', width: d, height: d,
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          border: `1px solid rgba(138,180,200,${[.05,.12,.26,.50,.85][i]})`,
          animation: `echoRingRotate ${['30s','20s reverse','13s','8s reverse','5s'][i]} linear infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', width: 2, height: 2,
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        borderRadius: '50%', background: '#8ab4c8',
        boxShadow: '0 0 3px 1px rgba(138,180,200,.5)',
      }} />
    </div>
  )
}

// ── Echo comment bubble on pattern card ───────────────────────────────────────
function EchoCommentBubble({ message, visible, isOwnPattern }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '10px 12px',
      background: isOwnPattern ? 'rgba(138,180,200,.07)' : 'rgba(138,180,200,.04)',
      borderTop: `1px solid ${isOwnPattern ? 'rgba(138,180,200,.16)' : 'rgba(138,180,200,.08)'}`,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity .4s cubic-bezier(0.16,1,0.3,1), transform .4s cubic-bezier(0.16,1,0.3,1)',
      pointerEvents: visible ? 'all' : 'none',
    }}>
      <EchoFaceMini />
      <div style={{
        fontFamily: "'Georgia', serif",
        fontStyle: 'italic',
        fontSize: '.82rem',
        color: isOwnPattern ? 'rgba(255,248,238,.65)' : 'rgba(255,248,238,.45)',
        lineHeight: 1.65,
      }}>
        {message}
      </div>
    </div>
  )
}

export default function PatternLibrary({ builds, onSelectImpression, onClose, avatarPattern = null, onChangeWithEcho }) {
  const [shapeFilter, setShapeFilter] = useState('ALL')
  const [hoveredCardId, setHoveredCardId] = useState(null)

  // ── Echo state ──
  const [echoMessages, setEchoMessages] = useState([])
  const [echoMood, setEchoMood] = useState('idle')
  const [echoLoading, setEchoLoading] = useState(false)
  const echoBottomRef = useRef(null)
  const hoverTimerRef = useRef(null)
  const prevBuildCountRef = useRef(0)

  // ── Keyframes ──
  useEffect(() => {
    if (document.getElementById('pl-kf')) return
    const s = document.createElement('style')
    s.id = 'pl-kf'
    s.textContent = [
      '@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes echoFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes echoRingRotate{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}',
    ].join('')
    document.head.appendChild(s)
  }, [])

  // ── Escape to close ──
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Auto-scroll Echo messages ──
  useEffect(() => {
    echoBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [echoMessages])

  const impressions = builds.filter(b => b.neuron_snapshot)
  if (!impressions.length) return null

  const insights = computeInsights(impressions)
  const filtered = shapeFilter === 'ALL'
    ? impressions
    : impressions.filter(b => (b.neuron_snapshot.shape || 'open').toUpperCase() === shapeFilter)

  // ── callEcho ──
  async function callEcho(trigger, focusedImpression = null) {
    if (echoLoading) return
    setEchoLoading(true)
    setEchoMood('thinking')

    const impressionData = builds
      .filter(b => b.neuron_snapshot)
      .map(b => ({
        id: b.id,
        summary: b.description || b.summary || '',
        shape: b.neuron_snapshot.shape,
        agentsPresent: b.neuron_snapshot.agentsPresent,
        messageCount: b.neuron_snapshot.messageCount,
        capturedAt: b.neuron_snapshot.capturedAt,
        buildId: b.id,
      }))

    if (impressionData.length < 1) {
      setEchoLoading(false)
      setEchoMood('idle')
      return
    }

    try {
      const res = await fetch('/vault/api/chat/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger, impressions: impressionData, focusedImpression }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      const msgId = Date.now()

      setEchoMessages(prev => [...prev, {
        id: msgId, trigger, text: '', timestamp: Date.now(),
        type: trigger === 'mount' || trigger === 'background' || trigger === 'ambient' ? 'insight' : 'delight',
      }])
      setEchoMood(trigger === 'new_arrival' ? 'delighted' : 'insight')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        setEchoMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: fullText } : m))
      }

      setTimeout(() => setEchoMood('idle'), 3000)
    } catch (err) {
      console.error('Echo error:', err)
    } finally {
      setEchoLoading(false)
    }
  }

  // ── Mount trigger ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    prevBuildCountRef.current = impressions.length
    const impressionCount = builds.filter(b => b.neuron_snapshot).length
    if (impressionCount < 3) return
    const t = setTimeout(() => callEcho('mount'), 1500)
    return () => clearTimeout(t)
  }, []) // intentionally runs once on mount

  // ── Ambient trigger ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      if (!echoLoading && echoMessages.length > 0) callEcho('ambient')
    }, 12000)
    return () => clearTimeout(t)
  }, []) // intentionally runs once on mount

  // ── New arrival trigger ──
  useEffect(() => {
    const currentCount = builds.filter(b => b.neuron_snapshot).length
    if (currentCount > prevBuildCountRef.current) {
      prevBuildCountRef.current = currentCount
      callEcho('new_arrival')
    }
  }, [builds]) // eslint-disable-line

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9200,
      background: 'rgba(8,7,6,0.97)',
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e1c19',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#e8e0d5', letterSpacing: '0.1em', fontWeight: 500 }}>
            THE PATTERN LIBRARY
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#3a3530', letterSpacing: '0.1em', marginTop: 2 }}>
            {impressions.length} IMPRESSION{impressions.length !== 1 ? 'S' : ''} CAPTURED
          </div>
        </div>

        {/* Change with Echo CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onChangeWithEcho && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
              {avatarPattern && (
                <span style={{
                  fontFamily: 'monospace', fontSize: 9,
                  color: 'rgba(138,180,200,.45)', letterSpacing: '.12em',
                }}>
                  YOUR PATTERN: <span style={{ color: '#8ab4c8' }}>{avatarPattern}</span>
                </span>
              )}
              <button
                onClick={onChangeWithEcho}
                style={{
                  background: 'none',
                  border: '1px solid rgba(138,180,200,.2)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  fontFamily: 'monospace', fontSize: 9,
                  letterSpacing: '.1em',
                  color: 'rgba(138,180,200,.55)',
                  cursor: 'pointer', transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(138,180,200,.5)'; e.currentTarget.style.color = '#8ab4c8' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(138,180,200,.2)'; e.currentTarget.style.color = 'rgba(138,180,200,.55)' }}
              >
                {avatarPattern ? '↺ Change with Echo' : '↺ Discover your pattern'}
              </button>
            </div>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#3a3530', fontSize: 18, lineHeight: 1, padding: '2px 4px',
            transition: 'color .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = '#9a7850'}
            onMouseLeave={e => e.currentTarget.style.color = '#3a3530'}>
            ×
          </button>
        </div>
      </div>

      {/* Insights bar */}
      <div style={{
        fontFamily: 'monospace', fontSize: 9, color: '#3a3530', letterSpacing: '0.1em',
        padding: '10px 24px', borderBottom: '1px solid #1a1815',
        display: 'flex', gap: 32, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span>MOST COMMON SHAPE:&nbsp;
          <span style={{ color: '#9a7850' }}>{insights.mostCommon?.toUpperCase() || '—'}</span>
        </span>
        <span>SOCRA PRESENT:&nbsp;
          <span style={{ color: '#9a7850' }}>{insights.socraSpeaks} BUILD{insights.socraSpeaks !== 1 ? 'S' : ''}</span>
        </span>
        <span>AVG MESSAGES:&nbsp;
          <span style={{ color: '#9a7850' }}>{insights.avgMessages}</span>
        </span>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 24px',
        borderBottom: '1px solid #1a1815', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {SHAPES.map(s => (
          <button key={s} onClick={() => setShapeFilter(s)} style={{
            background: 'none',
            border: `1px solid ${shapeFilter === s ? '#c44e1866' : '#2e2b27'}`,
            borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
            color: shapeFilter === s ? '#c44e18' : '#3a3530',
            fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em',
            transition: 'all 0.15s',
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Body — grid + Echo panel side by side */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Grid */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16, alignContent: 'start',
        }}>
          {filtered.map((build, i) => {
            const isHovered = hoveredCardId === build.id
            const isOwn = avatarPattern && build.neuron_snapshot?.patternTag === avatarPattern
            const echoComment = isOwn
              ? PATTERN_LIBRARY_OWN[avatarPattern]
              : (avatarPattern ? PATTERN_LIBRARY_HOVER[build.neuron_snapshot?.patternTag] : null)

            return (
              <div
                key={build.id}
                onClick={() => onSelectImpression(build)}
                style={{
                  cursor: 'pointer', background: '#0f0e0c',
                  border: `1px solid ${isOwn ? 'rgba(138,180,200,.3)' : '#1e1c19'}`,
                  borderRadius: 8, overflow: 'hidden',
                  transition: 'border-color 0.2s, transform 0.15s',
                  animation: `fadeUp 0.3s ease ${Math.min(i * 30, 600)}ms both`,
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = isOwn ? 'rgba(138,180,200,.5)' : '#9a785044'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  setHoveredCardId(build.id)
                  hoverTimerRef.current = setTimeout(() => callEcho('card_hover', {
                    id: build.id,
                    summary: build.description || build.summary || '',
                    shape: build.neuron_snapshot?.shape,
                    agentsPresent: build.neuron_snapshot?.agentsPresent,
                    messageCount: build.neuron_snapshot?.messageCount,
                    capturedAt: build.neuron_snapshot?.capturedAt,
                    buildId: build.id,
                  }), 1800)
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isOwn ? 'rgba(138,180,200,.3)' : '#1e1c19'
                  e.currentTarget.style.transform = 'translateY(0)'
                  setHoveredCardId(null)
                  clearTimeout(hoverTimerRef.current)
                }}
              >
                {/* Own pattern badge */}
                {isOwn && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    fontFamily: 'monospace', fontSize: 7,
                    letterSpacing: '.1em', color: '#8ab4c8',
                    background: 'rgba(138,180,200,.1)',
                    border: '1px solid rgba(138,180,200,.2)',
                    borderRadius: 3, padding: '2px 5px',
                  }}>
                    YOUR PATTERN
                  </div>
                )}

                <div style={{ padding: 12 }}>
                  <ImpressionThumb snapshot={build.neuron_snapshot} size={{ width: 176, height: 100 }} />
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, color: '#d8d0c5', lineHeight: 1.4 }}>
                      {(build.description || build.summary || 'Untitled build').substring(0, 48)}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#3a3530', marginTop: 5, letterSpacing: '0.1em' }}>
                      {formatImpressionDate(build.neuron_snapshot.capturedAt)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#9a785066', letterSpacing: '0.1em' }}>
                        {(build.neuron_snapshot.shape || 'open').toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {(build.neuron_snapshot.agentsPresent || [])
                          .filter(r => r !== 'human')
                          .slice(0, 5)
                          .map((role, j) => (
                            <div key={j} style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: colors[role] || '#3a3530', opacity: 0.7,
                            }} />
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Echo comment bubble — own pattern shows always, others on hover */}
                {echoComment && (
                  <EchoCommentBubble
                    message={echoComment}
                    visible={isOwn || isHovered}
                    isOwnPattern={isOwn}
                  />
                )}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', textAlign: 'center',
              fontFamily: 'Georgia, serif', fontSize: 14, fontStyle: 'italic',
              color: '#3a3530', padding: '60px 0',
            }}>
              No impressions match this shape.
            </div>
          )}
        </div>

        {/* Echo panel */}
        <div style={{
          width: 280, flexShrink: 0, borderLeft: '1px solid #2e2b27',
          display: 'flex', flexDirection: 'column', background: '#0d0c0b',
        }}>

          {/* Echo header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e1c19', flexShrink: 0 }}>
            <EchoWave mood={echoMood} size={32} />
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#8ab4c8', letterSpacing: '0.14em', marginTop: 8 }}>
              ECHO
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#3a3530', letterSpacing: '0.1em' }}>
              PATTERN RECOGNITION
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', position: 'relative' }}>
            {echoMessages.map(msg => (
              <div key={msg.id} style={{
                marginBottom: 20, fontSize: 13, lineHeight: 1.7,
                color: msg.type === 'insight' ? '#c8d8e0' : '#8a9ea8',
                fontFamily: "'Georgia', serif", fontStyle: 'italic',
                animation: 'echoFadeIn 0.4s ease forwards',
              }}>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', color: '#8ab4c844',
                  letterSpacing: '0.1em', marginBottom: 6, fontStyle: 'normal',
                }}>
                  {msg.trigger.toUpperCase()} · {formatTime(msg.timestamp)}
                </div>
                {msg.text}
              </div>
            ))}

            {echoLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <EchoWave mood="thinking" size={24} />
                <span style={{ fontSize: 11, color: '#3a3530', fontFamily: 'monospace' }}>reading...</span>
              </div>
            )}
            <div ref={echoBottomRef} />
          </div>

          {/* Empty state */}
          {echoMessages.length === 0 && !echoLoading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', position: 'absolute', bottom: 24, left: 0, right: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <EchoWave mood="idle" size={36} />
              </div>
              <div style={{ fontSize: 12, color: '#3a3530', fontFamily: "'Georgia', serif", fontStyle: 'italic', lineHeight: 1.6 }}>
                Opening the archive...
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
