'use client'

import { useEffect, useRef, useState } from 'react'

const ROLE_CONFIG = {
  human:      { color: '#f0ece4', label: 'You' },
  claude:     { color: '#d4541a', label: 'Architect' },
  gpt:        { color: '#ffc060', label: 'Spark' },
  scribe:     { color: '#60c8ff', label: 'Scribe' },
  steward:    { color: '#c060ff', label: 'Steward' },
  advocate:   { color: '#50c864', label: 'Advocate' },
  contrarian: { color: '#ff6060', label: 'Contrarian' },
  socra:      { color: '#c8a060', label: 'Socra' },
}

const EDGE_STYLE = {
  reply:    { stroke: 'rgba(255,255,255,0.22)', width: 1.2, dash: '' },
  tension:  { stroke: 'rgba(255,96,96,0.45)',   width: 1,   dash: '4,3' },
  approval: { stroke: 'rgba(80,200,100,0.38)',  width: 1,   dash: '2,4' },
}

const WIDTH = 480

export default function Neuron({ messages, open, onScrollToMessage }) {
  const svgRef      = useRef(null)
  const minimapRef  = useRef(null)
  const simRef      = useRef(null)
  const nodesRef    = useRef([])
  const [detail, setDetail] = useState(null)
  const [d3Ready, setD3Ready] = useState(false)

  // Inject slide-in keyframe once
  useEffect(() => {
    if (document.getElementById('neuron-kf')) return
    const s = document.createElement('style')
    s.id = 'neuron-kf'
    s.textContent = '@keyframes neuronSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}'
    document.head.appendChild(s)
  }, [])

  // Wait for D3 CDN load
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.d3) { setD3Ready(true); return }
    const id = setInterval(() => { if (window.d3) { setD3Ready(true); clearInterval(id) } }, 100)
    return () => clearInterval(id)
  }, [])

  // Build + run simulation whenever messages or open state changes
  useEffect(() => {
    if (!open || !d3Ready || !svgRef.current) return
    const d3 = window.d3

    const HEIGHT = svgRef.current.parentElement?.clientHeight || window.innerHeight - 44

    if (simRef.current) { simRef.current.stop(); simRef.current = null }
    d3.select(svgRef.current).selectAll('*').remove()

    // Build node / link data
    const nodeMap = new Map()
    const nodes = messages.map(m => {
      const n = {
        id: m.id,
        role: m.role || 'human',
        content: m.content || '',
        display_name: m.display_name || m.role,
        created_at: m.created_at,
        replyToId: m.replyToId || null,
        isReaction: m.isReaction || false,
        isCrossReaction: m.isCrossReaction || false,
        r: m.role === 'human' ? 7 : (m.isReaction ? 5 : 9),
        x: WIDTH / 2 + (Math.random() - 0.5) * 200,
        y: HEIGHT / 2 + (Math.random() - 0.5) * 200,
      }
      nodeMap.set(m.id, n)
      return n
    })
    nodesRef.current = nodes

    const links = []
    for (const n of nodes) {
      if (n.replyToId && nodeMap.has(n.replyToId)) {
        let type = 'reply'
        if (n.isCrossReaction)        type = 'tension'
        else if (n.role === 'contrarian') type = 'tension'
        else if (n.role === 'advocate')   type = 'approval'
        links.push({ source: n.replyToId, target: n.id, type })
      }
    }

    // Influence count (incoming links) → node size boost
    const influence = new Map()
    for (const l of links) {
      const t = typeof l.target === 'object' ? l.target.id : l.target
      influence.set(t, (influence.get(t) || 0) + 1)
    }
    for (const n of nodes) {
      n._r = n.r + Math.min((influence.get(n.id) || 0) * 1.5, 6)
    }

    // SVG setup
    const svg = d3.select(svgRef.current).attr('width', WIDTH).attr('height', HEIGHT)

    // Glow filters
    const defs = svg.append('defs')
    Object.keys(ROLE_CONFIG).forEach(role => {
      const f = defs.append('filter').attr('id', `ng-${role}`)
        .attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%')
      f.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur')
      const fm = f.append('feMerge')
      fm.append('feMergeNode').attr('in', 'blur')
      fm.append('feMergeNode').attr('in', 'SourceGraphic')
    })

    // Socra gravity field indicator
    svg.append('circle')
      .attr('cx', WIDTH / 2).attr('cy', HEIGHT / 2).attr('r', 120)
      .attr('fill', 'none').attr('stroke', 'rgba(200,160,96,0.1)')
      .attr('stroke-width', 1).attr('stroke-dasharray', '3,5')
    svg.append('circle')
      .attr('cx', WIDTH / 2).attr('cy', HEIGHT / 2).attr('r', 4)
      .attr('fill', ROLE_CONFIG.socra.color).attr('opacity', 0.5)
      .attr('filter', 'url(#ng-socra)')
    svg.append('text')
      .attr('x', WIDTH / 2 + 8).attr('y', HEIGHT / 2 + 3)
      .attr('font-family', 'var(--font-mono)').attr('font-size', 7)
      .attr('fill', 'rgba(200,160,96,0.45)').attr('letter-spacing', '0.12em')
      .text('SOCRA')

    // Edges
    const linkPaths = svg.append('g').selectAll('path').data(links).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).stroke)
      .attr('stroke-width', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).width)
      .attr('stroke-dasharray', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).dash)
      .attr('opacity', 0.65)

    // Nodes
    const nodeEls = svg.append('g').selectAll('g').data(nodes).enter().append('g')
      .style('cursor', 'pointer')

    nodeEls.each(function(d) {
      const g = d3.select(this)
      const cfg = ROLE_CONFIG[d.role] || { color: '#888', label: '?' }
      const r = d._r

      if (d.role === 'steward') {
        g.append('rect')
          .attr('x', -r - 1).attr('y', -r - 1)
          .attr('width', (r + 1) * 2).attr('height', (r + 1) * 2)
          .attr('rx', 2).attr('fill', cfg.color).attr('opacity', 0.82)
          .attr('filter', `url(#ng-steward)`)
      } else if (d.role === 'contrarian') {
        const s = r + 2
        g.append('polygon')
          .attr('points', `0,${-s} ${s},0 0,${s} ${-s},0`)
          .attr('fill', cfg.color).attr('opacity', 0.82)
          .attr('filter', `url(#ng-contrarian)`)
      } else {
        g.append('circle').attr('r', r)
          .attr('fill', cfg.color).attr('opacity', 0.82)
          .attr('filter', `url(#ng-${d.role})`)
      }

      g.append('text')
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('font-family', 'var(--font-mono)')
        .attr('font-size', Math.max(r * 0.72, 6))
        .attr('fill', 'rgba(0,0,0,0.72)')
        .attr('pointer-events', 'none')
        .text(cfg.label[0])
    })

    // Hover
    nodeEls
      .on('mouseenter', function() {
        d3.select(this).select('circle,rect,polygon')
          .attr('opacity', 1).attr('transform', 'scale(1.18)')
      })
      .on('mouseleave', function() {
        d3.select(this).select('circle,rect,polygon')
          .attr('opacity', 0.82).attr('transform', 'scale(1)')
      })
      .on('click', function(event, d) {
        event.stopPropagation()
        setDetail(d)
      })

    // Force simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(72).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-95))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', d3.forceCollide(d => d._r + 5))

    // Socra gravity — pulls nearby nodes toward center
    sim.force('socra', () => {
      const cx = WIDTH / 2, cy = HEIGHT / 2
      for (const n of nodes) {
        const dx = cx - n.x, dy = cy - n.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120 && dist > 0) {
          n.vx += dx * 0.022
          n.vy += dy * 0.022
        }
      }
    })

    simRef.current = sim

    sim.on('tick', () => {
      // Constrain to bounds
      for (const n of nodes) {
        const r = n._r + 5
        n.x = Math.max(r, Math.min(WIDTH - r, n.x))
        n.y = Math.max(r, Math.min(HEIGHT - r, n.y))
      }

      // Quadratic bezier edges
      linkPaths.attr('d', d => {
        const sx = d.source.x, sy = d.source.y
        const tx = d.target.x, ty = d.target.y
        const mx = (sx + tx) / 2, my = (sy + ty) / 2
        const dx = tx - sx, dy = ty - sy
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const cx = mx - (dy / len) * 28
        const cy = my + (dx / len) * 28
        return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`
      })

      nodeEls.attr('transform', d => `translate(${d.x},${d.y})`)
      updateMinimap(nodes, WIDTH, HEIGHT)
    })

    // Drag
    const drag = d3.drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    nodeEls.call(drag)

    return () => sim.stop()
  }, [open, messages, d3Ready]) // eslint-disable-line

  function updateMinimap(nodes, svgW, svgH) {
    const canvas = minimapRef.current
    if (!canvas || !nodes.length) return
    const ctx = canvas.getContext('2d')
    const W = 80, H = 60
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(8,7,6,0.85)'
    ctx.fillRect(0, 0, W, H)
    for (const n of nodes) {
      const x = (n.x / svgW) * W
      const y = (n.y / svgH) * H
      const cfg = ROLE_CONFIG[n.role] || { color: '#888' }
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fillStyle = cfg.color
      ctx.globalAlpha = 0.72
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: WIDTH, height: '100vh',
      background: 'rgba(8,7,6,0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderLeft: '1px solid var(--border)',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      animation: 'neuronSlideIn 0.28s var(--ease, cubic-bezier(.4,0,.2,1))',
    }}>
      {/* Header */}
      <div style={{ height: 44, padding: '0 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(200,160,96,0.75)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.55rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--mid)' }}>The Neuron</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.42rem', letterSpacing: '.08em', color: 'var(--muted)' }}>topology</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.45rem', color: 'var(--muted)' }}>{messages.length} nodes</span>
      </div>

      {/* Graph area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        {!d3Ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.5rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted)' }}>loading graph…</span>
          </div>
        )}
        {messages.length === 0 && d3Ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'var(--font-caveat)', fontSize: '1.4rem', color: 'var(--muted)', fontStyle: 'italic', opacity: .35 }}>No messages yet.</span>
          </div>
        )}

        {/* Legend */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
          {[
            { label: 'reply',    stroke: EDGE_STYLE.reply.stroke,    dash: '' },
            { label: 'tension',  stroke: EDGE_STYLE.tension.stroke,  dash: '4,3' },
            { label: 'approval', stroke: EDGE_STYLE.approval.stroke, dash: '2,4' },
          ].map(e => (
            <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <svg width={20} height={6}>
                <line x1={0} y1={3} x2={20} y2={3}
                  stroke={e.stroke} strokeWidth={1.2}
                  strokeDasharray={e.dash} />
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.38rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', opacity: .7 }}>{e.label}</span>
            </div>
          ))}
        </div>

        {/* Minimap */}
        <canvas ref={minimapRef} width={80} height={60}
          style={{ position: 'absolute', bottom: 12, right: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, opacity: 0.75 }} />
      </div>

      {/* Detail panel — slides up from bottom */}
      {detail && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 168,
          background: 'rgba(14,12,10,0.98)',
          borderTop: '1px solid var(--border)',
          padding: '.8rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <div style={{ width: 5, height: 5, borderRadius: detail.role === 'contrarian' ? 0 : '50%', background: ROLE_CONFIG[detail.role]?.color || 'var(--muted)', transform: detail.role === 'contrarian' ? 'rotate(45deg)' : 'none' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: ROLE_CONFIG[detail.role]?.color || 'var(--text)' }}>
                {detail.display_name}
              </span>
            </div>
            <button onClick={() => setDetail(null)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '.55rem', cursor: 'none', padding: '.1rem .3rem', lineHeight: 1 }}>
              ✕
            </button>
          </div>
          <p style={{
            fontFamily: 'var(--font-caveat)', fontSize: '.95rem', color: 'var(--mid)', lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            marginBottom: '.55rem',
          }}>
            {detail.content}
          </p>
          <button
            onClick={() => { onScrollToMessage?.(detail.id); setDetail(null) }}
            data-hover
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--ember)', background: 'none', border: '1px solid rgba(212,84,26,0.3)',
              borderRadius: '2px', padding: '.28rem .65rem', cursor: 'none', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ember)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,84,26,0.3)' }}>
            Show in Lattice →
          </button>
        </div>
      )}
    </div>
  )
}
