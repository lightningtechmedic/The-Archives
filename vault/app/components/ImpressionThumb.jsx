'use client'

// ── ImpressionThumb ───────────────────────────────────────────────────────────
// Static SVG mini-graph of a neuron_snapshot. No D3, no simulation.
// Nodes positioned by role angle + deterministic jitter.

const colors = {
  user:        '#e8e0d5',
  architect:   '#c44e18',
  spark:       '#a07828',
  scribe:      '#4a64d8',
  steward:     '#9a7850',
  advocate:    '#b8856a',
  contrarian:  '#607080',
  socra:       '#3a3530',
}

const roleAngles = {
  user:        0,
  architect:   45,
  spark:       90,
  scribe:      135,
  steward:     180,
  advocate:    225,
  contrarian:  270,
  socra:       315,
}

// Map raw message roles → display roles used in colors/angles
const roleNorm = {
  human:       'user',
  claude:      'architect',
  gpt:         'spark',
  scribe:      'scribe',
  steward:     'steward',
  advocate:    'advocate',
  contrarian:  'contrarian',
  socra:       'socra',
}

export default function ImpressionThumb({ snapshot, size = { width: 88, height: 66 } }) {
  if (!snapshot?.nodes?.length) return null

  const { width, height } = size
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.32

  // Build positioned node list
  const nodeMap = new Map()
  const nodes = snapshot.nodes.map((n, i) => {
    const role = roleNorm[n.role] || n.role || 'user'
    const baseAngle = ((roleAngles[role] ?? 0) * Math.PI) / 180
    const jitter = (i % 3 - 1) * 0.2
    const r = radius * (0.6 + (i % 4) * 0.12)
    const node = {
      ...n,
      _role: role,
      _x: cx + Math.cos(baseAngle + jitter) * r,
      _y: cy + Math.sin(baseAngle + jitter) * r,
    }
    nodeMap.set(n.id, node)
    return node
  })

  // Build edges from replyToId chains
  const edges = []
  for (const n of nodes) {
    if (n.replyToId && nodeMap.has(n.replyToId)) {
      edges.push({ source: nodeMap.get(n.replyToId), target: n })
    }
  }

  return (
    <svg
      width={width}
      height={height}
      style={{
        display: 'block',
        background: '#0a0908',
        borderRadius: 4,
        border: '1px solid #1e1c19',
        flexShrink: 0,
      }}
    >
      {/* Edges */}
      {edges.map((e, i) => {
        const col = colors[e.target._role] || '#888'
        return (
          <line
            key={i}
            x1={e.source._x} y1={e.source._y}
            x2={e.target._x} y2={e.target._y}
            stroke={col}
            strokeWidth={0.8}
            opacity={0.25}
          />
        )
      })}
      {/* Nodes */}
      {nodes.map((n, i) => {
        const col = colors[n._role] || '#888'
        const r = n._role === 'socra' ? 1.5 : 2.5
        return (
          <circle
            key={i}
            cx={n._x}
            cy={n._y}
            r={r}
            fill={col}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}
