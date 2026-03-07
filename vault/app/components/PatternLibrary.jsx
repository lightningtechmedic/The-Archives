'use client'

import { useState, useEffect } from 'react'
import ImpressionThumb from '@/components/ImpressionThumb'
import { agentColors as colors } from '@/lib/agentColors'

function formatImpressionDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

export default function PatternLibrary({ builds, onSelectImpression, onClose }) {
  const [shapeFilter, setShapeFilter] = useState('ALL')

  // Inject fadeUp keyframe once
  useEffect(() => {
    if (document.getElementById('pl-kf')) return
    const s = document.createElement('style')
    s.id = 'pl-kf'
    s.textContent = '@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}'
    document.head.appendChild(s)
  }, [])

  const impressions = builds.filter(b => b.neuron_snapshot)
  if (!impressions.length) return null

  const insights = computeInsights(impressions)
  const filtered = shapeFilter === 'ALL'
    ? impressions
    : impressions.filter(b => (b.neuron_snapshot.shape || 'open').toUpperCase() === shapeFilter)

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

      {/* Grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 24,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16, alignContent: 'start',
      }}>
        {filtered.map((build, i) => (
          <div
            key={build.id}
            onClick={() => onSelectImpression(build)}
            style={{
              cursor: 'pointer',
              background: '#0f0e0c',
              border: '1px solid #1e1c19',
              borderRadius: 8, padding: 12,
              transition: 'border-color 0.2s, transform 0.15s',
              animation: `fadeUp 0.3s ease ${Math.min(i * 30, 600)}ms both`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#9a785044'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1e1c19'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <ImpressionThumb
              snapshot={build.neuron_snapshot}
              size={{ width: 176, height: 100 }}
            />
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
                        background: colors[role] || '#3a3530',
                        opacity: 0.7,
                      }} />
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        ))}

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
    </div>
  )
}
