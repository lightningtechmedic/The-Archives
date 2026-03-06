'use client'

import { useState } from 'react'

const ROWS = [
  { letter: 'V', word: 'Vision of'  },
  { letter: 'A', word: 'Active'     },
  { letter: 'U', word: 'Unified'    },
  { letter: 'L', word: 'Living'     },
  { letter: 'T', word: 'Thought'    },
]

const FEATURES = [
  {
    icon: '✦', name: 'Notes',
    color: 'var(--ember)',
    dim: 'rgba(24,21,16,0.9)',
    border: 'rgba(255,255,255,0.055)',
    desc: 'Your thinking, private by default. Write freely — share to your Enclave when ready.',
  },
  {
    icon: '◈', name: 'Lattice',
    color: 'var(--gold)',
    dim: 'rgba(24,21,16,0.9)',
    border: 'rgba(255,255,255,0.055)',
    desc: 'Your AI collaboration space. The Architect structures. The Spark ignites. Both remember everything you share.',
  },
  {
    icon: '⊞', name: 'Board',
    color: 'var(--cyan)',
    dim: 'rgba(24,21,16,0.9)',
    border: 'rgba(255,255,255,0.055)',
    desc: 'Sticky notes for fast captures. Pin insights from Lattice directly to your board. Drag, reorder, sketch.',
  },
  {
    icon: '◆', name: 'Enclaves',
    color: 'rgba(240,236,228,0.4)',
    dim: 'rgba(24,21,16,0.9)',
    border: 'rgba(255,255,255,0.055)',
    desc: 'Create a collaboration group. Invite your team. Share memory, notes, and Lattice with the people who matter.',
  },
]

function S({ delay, duration, children }) {
  return (
    <div style={{
      opacity: 0,
      animation: `fadeUp ${duration || '.7s'} cubic-bezier(.16,1,.3,1) ${delay}s forwards`,
    }}>
      {children}
    </div>
  )
}

export default function WelcomeModal({ supabase, onDismiss }) {
  const [dontShow, setDontShow] = useState(false)
  const [saving,   setSaving]   = useState(false)

  async function handleEnter() {
    if (dontShow) {
      setSaving(true)
      await supabase.auth.updateUser({ data: { has_seen_welcome: true } })
      setSaving(false)
    }
    onDismiss()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
      opacity: 0,
      animation: 'fadeIn .5s ease .1s forwards',
    }}>

      {/* Card */}
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 640,
        maxHeight: '90vh',
        background: 'rgba(17,16,9,0.98)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        padding: '3rem',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        boxShadow: '0 32px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
      }}>

        {/* Ember radial glow */}
        <div aria-hidden style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 120,
          background: 'radial-gradient(ellipse, rgba(212,84,26,0.22), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* X dismiss */}
        <button onClick={onDismiss}
          style={{
            position: 'absolute', top: 19, right: 19,
            width: 28, height: 28, borderRadius: '50%',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.055)',
            color: 'rgba(240,236,228,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '.7rem', lineHeight: 1,
            cursor: 'none', transition: 'all .2s',
            zIndex: 10,
            fontFamily: 'var(--font-mono)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(24,21,16,0.9)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(240,236,228,0.88)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.055)'; e.currentTarget.style.color = 'rgba(240,236,228,0.28)' }}>
          ✕
        </button>

        {/* ── S1: Brand + Acronym ── */}
        <S delay={0.2}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            paddingBottom: '2rem', marginBottom: '2rem',
            borderBottom: '1px solid rgba(255,255,255,0.055)',
          }}>
            {/* Brand left — stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.18rem', flexShrink: 0 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--ember)',
                boxShadow: '0 0 12px rgba(212,84,26,0.6)',
                marginBottom: '.4rem',
                animation: 'pulseSlow 3s ease-in-out infinite',
              }} />
              <span style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic', fontWeight: 300,
                fontSize: '2.8rem', lineHeight: 1,
                color: 'rgba(240,236,228,0.9)',
                whiteSpace: 'nowrap',
              }}>
                The Vault
              </span>
            </div>

            {/* Vertical divider */}
            <div style={{
              width: 1, height: 60, flexShrink: 0,
              background: 'linear-gradient(transparent, rgba(255,255,255,0.09), transparent)',
            }} />

            {/* Acronym */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.14rem' }}>
              {ROWS.map(r => (
                <div key={r.letter} style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem' }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic', fontWeight: 400,
                    fontSize: '1rem', color: 'var(--ember)',
                    width: '.8rem', flexShrink: 0, lineHeight: 1.4,
                  }}>{r.letter}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '.48rem', letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(240,236,228,0.32)',
                    lineHeight: 1.4,
                  }}>{r.word}</span>
                </div>
              ))}
            </div>
          </div>
        </S>

        {/* ── S2: Heading + Body ── */}
        <S delay={0.7}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic', fontWeight: 300,
              fontSize: '1.5rem', lineHeight: 1.3,
              color: 'rgba(240,236,228,0.88)',
              marginBottom: '.8rem',
            }}>
              A private space where your team thinks together.
            </h2>
            <p style={{
              fontFamily: 'var(--font-caveat)',
              fontSize: '1.05rem', lineHeight: 1.7,
              color: 'rgba(240,236,228,0.55)',
            }}>
              The Vault is where ideas live before they become decisions. Write, think, collaborate — with your team and with AI that actually remembers. Everything here is yours. Private until you say otherwise.
            </p>
          </div>
        </S>

        {/* ── S3: Feature grid ── */}
        <S delay={1.1}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '.8rem', marginBottom: '2rem',
          }}>
            {FEATURES.map(f => (
              <div key={f.name} style={{
                background: f.dim,
                border: `1px solid ${f.border}`,
                borderRadius: 8,
                padding: '1.2rem',
                transition: 'border-color .2s, background .2s, transform .2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
                <span style={{
                  display: 'block',
                  fontSize: '1.3rem', color: f.color,
                  lineHeight: 1, marginBottom: '.6rem',
                }}>{f.icon}</span>
                <span style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '.5rem', letterSpacing: '.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(240,236,228,0.88)',
                  marginBottom: '.4rem',
                }}>{f.name}</span>
                <p style={{
                  fontFamily: 'var(--font-caveat)',
                  fontSize: '.9rem', lineHeight: 1.55,
                  color: 'rgba(240,236,228,0.28)',
                }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </S>

        {/* ── S4: Closing line ── */}
        <S delay={1.6}>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.055)',
            paddingTop: '1.5rem',
            marginBottom: '1.5rem',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic', fontWeight: 300,
              fontSize: '1.1rem', lineHeight: 1.5,
              color: 'rgba(240,236,228,0.4)',
            }}>
              "Everything here is yours.<br />Private until you say otherwise."
            </p>
          </div>
        </S>

        {/* ── S5: Footer ── */}
        <S delay={2.1} duration=".6s">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', position: 'relative', zIndex: 2 }}>

            {/* Don't show checkbox */}
            <div
              onClick={() => setDontShow(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'none' }}>
              <div style={{
                width: 14, height: 14, flexShrink: 0,
                border: `1px solid ${dontShow ? 'var(--ember)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius: 2,
                background: dontShow ? 'var(--ember)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .2s',
              }}>
                {dontShow && (
                  <span style={{ color: '#fff', fontSize: '.5rem', lineHeight: 1, fontWeight: 700 }}>✓</span>
                )}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '.46rem', letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'rgba(240,236,228,0.28)',
                userSelect: 'none',
                transition: 'color .2s',
              }}>
                Don't show this again
              </span>
            </div>

            {/* Enter button */}
            <button
              onClick={handleEnter}
              disabled={saving}
              style={{
                padding: '.55rem 1.2rem',
                background: 'var(--ember)',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '.52rem', letterSpacing: '.18em',
                textTransform: 'uppercase',
                cursor: 'none',
                transition: 'all .2s',
                boxShadow: '0 4px 20px rgba(212,84,26,0.3)',
                opacity: saving ? 0.6 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#c04010'; e.currentTarget.style.boxShadow = '0 4px 28px rgba(212,84,26,0.5)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--ember)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,84,26,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}>
              {saving ? 'Saving…' : 'Enter the Vault →'}
            </button>
          </div>
        </S>

      </div>
    </div>
  )
}
