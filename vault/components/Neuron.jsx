'use client'

import { useEffect, useRef, useState } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

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

const ARROW_FILL = {
  reply:    'rgba(255,255,255,0.45)',
  tension:  'rgba(255,96,96,0.5)',
  approval: 'rgba(80,200,100,0.5)',
}

const WIDTH = 480
const NODE_CAP = 200
const NODE_TRIM = 20

// ── Pure helpers ──────────────────────────────────────────────────────────────

function calcEdgePath(d) {
  if (d?.source?.x == null || d?.target?.x == null) return ''
  const sx = d.source.x, sy = d.source.y
  const tx = d.target.x, ty = d.target.y
  const mx = (sx + tx) / 2, my = (sy + ty) / 2
  const dx = tx - sx, dy = ty - sy
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return `M ${sx} ${sy} Q ${mx - (dy / len) * 28} ${my + (dx / len) * 28} ${tx} ${ty}`
}

function drawShape(d3, g, d) {
  const cfg = ROLE_CONFIG[d.role] || { color: '#888', label: '?' }
  const r = d._r || d.r
  if (d.role === 'steward') {
    g.append('rect')
      .attr('x', -(r + 1)).attr('y', -(r + 1))
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
  g.append('text').attr('class', 'node-label')
    .attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-family', 'var(--font-mono)')
    .attr('font-size', Math.max(r * 0.72, 6))
    .attr('fill', 'rgba(0,0,0,0.72)')
    .attr('pointer-events', 'none')
    .text(cfg.label[0])
  g.append('text').attr('class', 'node-preview')
    .attr('text-anchor', 'middle').attr('y', r + 14)
    .attr('font-family', 'var(--font-mono)')
    .attr('font-size', 5.5)
    .attr('fill', 'rgba(255,255,255,0.4)')
    .attr('pointer-events', 'none')
    .attr('opacity', 0)
    .text((d.content || '').slice(0, 40) + ((d.content || '').length > 40 ? '…' : ''))
}

function setNodeRadius(d3, g, d, r) {
  if (d.role === 'steward') {
    g.select('rect').attr('x', -(r + 1)).attr('y', -(r + 1)).attr('width', (r + 1) * 2).attr('height', (r + 1) * 2)
  } else if (d.role === 'contrarian') {
    g.select('polygon').attr('points', `0,${-(r + 2)} ${r + 2},0 0,${r + 2} ${-(r + 2)},0`)
  } else {
    g.select('circle').attr('r', r)
  }
}

export function detectShape(nodes, edges) {
  const n = nodes.filter(nd => !nd._ghost)
  const e = edges
  const avgConnections = e.length / Math.max(n.length, 1)
  const hasTensionEdges = e.filter(ed => ed.type === 'tension').length >= 2
  const sparkNode = n.find(nd => nd.role === 'gpt')
  const sparkConnections = sparkNode ? e.filter(ed => {
    const src = typeof ed.source === 'object' ? ed.source.id : ed.source
    const tgt = typeof ed.target === 'object' ? ed.target.id : ed.target
    return src === sparkNode.id || tgt === sparkNode.id
  }).length : 0
  const stewardIsRecent = n.length > 3 && n.slice(-3).some(nd => nd.role === 'steward')
  if (hasTensionEdges) return 'CONTESTED'
  if (stewardIsRecent) return 'CONVERGING'
  if (sparkConnections > avgConnections * 1.8) return 'EXPANSIVE'
  if (avgConnections > 2.5) return 'FOCUSED'
  return 'OPEN'
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatImpressionDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Neuron({ messages, open, onScrollToMessage, impression, onClose }) {
  // ── Refs ──
  const svgRef           = useRef(null)
  const minimapRef       = useRef(null)
  const simRef           = useRef(null)
  const zoomRef          = useRef(null)
  const zoomContainerRef = useRef(null)
  const currentXfRef     = useRef(null)    // current D3 zoom transform
  const nodesRef         = useRef([])
  const linksRef         = useRef([])
  const nodeGroupRef     = useRef(null)
  const linkGroupRef     = useRef(null)
  const nodeElsRef       = useRef(null)
  const linkPathsRef     = useRef(null)
  const rafRef           = useRef(null)
  const breathStartRef   = useRef(0)
  const lastMsgTimeRef   = useRef(Date.now())
  const graphOpRef       = useRef(1)
  const divideRef        = useRef({ adv: 0, contr: 0, advNode: null, contrNode: null })
  const liveModeRef      = useRef(true)
  const hasOpenedRef     = useRef(false)   // stagger on first open only
  const heightRef        = useRef(600)

  // ── State ──
  const [detail, setDetail]             = useState(null)
  const [d3Ready, setD3Ready]           = useState(false)
  const [liveMode, setLiveMode]         = useState(true)
  const [snapshotTime, setSnapshotTime] = useState(null)
  const [rebuildKey, setRebuildKey]     = useState(0)
  const [zoomLevel, setZoomLevel]       = useState(2)
  const [shape, setShape]               = useState('OPEN')
  const [hiddenCount, setHiddenCount]   = useState(0)

  useEffect(() => { liveModeRef.current = liveMode }, [liveMode])

  // ── Keyframes inject ──
  useEffect(() => {
    if (document.getElementById('neuron-kf')) return
    const s = document.createElement('style')
    s.id = 'neuron-kf'
    s.textContent = [
      '@keyframes neuronSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}',
      '@keyframes neuronEmptyBreathe{0%,100%{opacity:.35}50%{opacity:.7}}',
      '@keyframes neuronCompassSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
      '@keyframes neuronLivePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)}}',
    ].join('')
    document.head.appendChild(s)
  }, [])

  // ── D3 ready ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.d3) { setD3Ready(true); return }
    const id = setInterval(() => { if (window.d3) { setD3Ready(true); clearInterval(id) } }, 100)
    return () => clearInterval(id)
  }, [])

  // ── Keyboard shortcuts (1/2/3) — only when open ──
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === '1') setZoomLevel(1)
      if (e.key === '2') setZoomLevel(2)
      if (e.key === '3') setZoomLevel(3)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // ── Escape to close — always wired so cleanup fires correctly ──
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ── Main build ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const isImpression = !!impression
    const effectMsgs = isImpression
      ? (impression?.snapshot?.nodes || []).map(n => ({
          id: n.id, role: n.role || 'human',
          content: n.contentPreview || '', display_name: ROLE_CONFIG[n.role]?.label || n.role,
          created_at: n.timestamp, replyToId: n.replyToId || null,
          isReaction: false, isCrossReaction: false,
        }))
      : messages
    if (!open || !d3Ready || !svgRef.current || effectMsgs.length < 3) return
    const d3 = window.d3
    const HEIGHT = svgRef.current.parentElement?.clientHeight || window.innerHeight - 44
    heightRef.current = HEIGHT

    if (simRef.current) { simRef.current.stop(); simRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    d3.select(svgRef.current).selectAll('*').remove()
    divideRef.current = { adv: 0, contr: 0, advNode: null, contrNode: null }

    const snap = effectMsgs
    const nodeMap = new Map()
    const nodes = snap.map(m => {
      const n = {
        id: m.id, role: m.role || 'human',
        content: m.content || '', display_name: m.display_name || m.role,
        created_at: m.created_at, replyToId: m.replyToId || null,
        isReaction: m.isReaction || false, isCrossReaction: m.isCrossReaction || false,
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
    linksRef.current = links

    const influence = new Map()
    for (const l of links) {
      const t = typeof l.target === 'object' ? l.target.id : l.target
      influence.set(t, (influence.get(t) || 0) + 1)
    }
    for (const n of nodes) n._r = n.r + Math.min((influence.get(n.id) || 0) * 1.5, 6)

    setShape(detectShape(nodes, links))

    // SVG
    const svg = d3.select(svgRef.current).attr('width', WIDTH).attr('height', HEIGHT)

    // ── Defs ──
    const defs = svg.append('defs')

    // Radial gradient background
    const bgGrad = defs.append('radialGradient').attr('id', 'ng-bg')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '70%')
    bgGrad.append('stop').attr('offset', '0%').attr('stop-color', '#141210')
    bgGrad.append('stop').attr('offset', '100%').attr('stop-color', '#080706')

    // Glow filters — boosted to ~45% visible glow
    Object.keys(ROLE_CONFIG).forEach(role => {
      const f = defs.append('filter').attr('id', `ng-${role}`)
        .attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%')
      f.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'blur')
      f.append('feComponentTransfer').attr('in', 'blur').attr('result', 'boostedBlur')
        .append('feFuncA').attr('type', 'linear').attr('slope', '2.8')
      const fm = f.append('feMerge')
      fm.append('feMergeNode').attr('in', 'boostedBlur')
      fm.append('feMergeNode').attr('in', 'SourceGraphic')
    })

    // Arrowhead markers per edge type
    Object.entries(ARROW_FILL).forEach(([type, fill]) => {
      defs.append('marker').attr('id', `arr-${type}`)
        .attr('markerWidth', 4).attr('markerHeight', 4)
        .attr('refX', 3).attr('refY', 2).attr('orient', 'auto')
        .append('path').attr('d', 'M0,0 L0,4 L4,2 z').attr('fill', fill)
    })

    // Room Divides gradient
    const grad = defs.append('linearGradient').attr('id', 'ng-divide-grad')
      .attr('gradientUnits', 'userSpaceOnUse')
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#b8856a')
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#c44e18')

    // Background rect (outside zoom — stays fixed)
    svg.append('rect').attr('width', WIDTH).attr('height', HEIGHT)
      .attr('fill', 'url(#ng-bg)').attr('pointer-events', 'none')

    // ── Zoom container ──
    const zoomContainer = svg.append('g').attr('id', 'ng-zc')
    zoomContainerRef.current = zoomContainer
    currentXfRef.current = d3.zoomIdentity

    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 6])
      .on('zoom', event => {
        zoomContainer.attr('transform', event.transform)
        currentXfRef.current = event.transform
      })
    svg.call(zoomBehavior)
    zoomRef.current = zoomBehavior

    // ── Socra field (inside zoom container) ──
    zoomContainer.append('circle')
      .attr('cx', WIDTH / 2).attr('cy', HEIGHT / 2).attr('r', 120)
      .attr('fill', 'none').attr('stroke', 'rgba(200,160,96,0.1)')
      .attr('stroke-width', 1).attr('stroke-dasharray', '3,5')
    zoomContainer.append('circle')
      .attr('cx', WIDTH / 2).attr('cy', HEIGHT / 2).attr('r', 4)
      .attr('fill', ROLE_CONFIG.socra.color).attr('opacity', 0.5)
      .attr('filter', 'url(#ng-socra)')
    zoomContainer.append('text')
      .attr('x', WIDTH / 2 + 8).attr('y', HEIGHT / 2 + 3)
      .attr('font-family', 'var(--font-mono)').attr('font-size', 7)
      .attr('fill', 'rgba(200,160,96,0.45)').attr('letter-spacing', '0.12em')
      .text('SOCRA')

    // ── Edges ──
    const linkG = zoomContainer.append('g')
    linkGroupRef.current = linkG
    const linkPaths = linkG.selectAll('path').data(links).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).stroke)
      .attr('stroke-width', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).width)
      .attr('stroke-dasharray', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).dash)
      .attr('marker-end', d => `url(#arr-${d.type || 'reply'})`)
      .attr('opacity', 0.65)
    linkPathsRef.current = linkPaths

    // ── Nodes ──
    const nodeG = zoomContainer.append('g')
    nodeGroupRef.current = nodeG
    const nodeEls = nodeG.selectAll('g').data(nodes).enter().append('g').style('cursor', 'pointer')
    nodeEls.each(function(d) { drawShape(d3, d3.select(this), d) })
    attachInteractions(d3, nodeEls)
    nodeElsRef.current = nodeEls

    // ── Simulation ──
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(72).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-95))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', d3.forceCollide(d => d._r + 5))
    sim.force('socra', makeSocraForce(nodes, WIDTH, HEIGHT))
    simRef.current = sim

    function tick() {
      const all = nodesRef.current.filter(n => !n._ghost)
      for (const n of all) {
        const r = n._r + 5
        n.x = Math.max(r, Math.min(WIDTH - r, n.x))
        n.y = Math.max(r, Math.min(HEIGHT - r, n.y))
      }
      linkGroupRef.current?.selectAll('path').each(function(d) {
        if (d?.source?.x != null) d3.select(this).attr('d', calcEdgePath(d))
      })
      nodeGroupRef.current?.selectAll('g').each(function(d) {
        if (d?.x != null) d3.select(this).attr('transform', `translate(${d.x},${d.y})`)
      })
      updateMinimap()
    }
    sim.on('tick', tick)
    if (isImpression) sim.on('end', () => sim.stop())

    const drag = d3.drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    nodeEls.call(drag)

    // ── Staggered entrance (first open only) ──
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true
      const staggerDelay = Math.min(40, 1200 / Math.max(nodes.length, 1))
      nodeEls.attr('opacity', 0).each(function(_, i) {
        d3.select(this).transition().delay(i * staggerDelay).duration(300).attr('opacity', 1)
      })
    }

    // ── Breathing RAF ──
    breathStartRef.current = performance.now()
    function breathe(ts) {
      if (!svgRef.current) return
      const t = ts - breathStartRef.current
      const silentMs = Date.now() - lastMsgTimeRef.current
      const isSilent = silentMs > 90000
      const divisor = isSilent ? 6000 : 3000
      const targetOp = isSilent ? 0.6 : 1.0
      graphOpRef.current += (targetOp - graphOpRef.current) * (isSilent ? 0.004 : 0.04)
      if (Math.abs(graphOpRef.current - targetOp) > 0.002) {
        d3.select(svgRef.current).attr('opacity', graphOpRef.current)
      }
      if (nodeElsRef.current) {
        let i = 0
        nodeElsRef.current.each(function(d) {
          if (!d._ghost) {
            const breathAmt = Math.sin(t / divisor + i * 0.4) * 1.2
            setNodeRadius(d3, d3.select(this), d, (d._r || d.r) + breathAmt)
          }
          i++
        })
      }
      if (linkPathsRef.current) {
        const edgeOp = 0.35 + Math.sin(t / divisor) * 0.08
        linkPathsRef.current.each(function(d) {
          if (!d?._ghost && !d?._pinOpacity) d3.select(this).attr('opacity', edgeOp + 0.3)
        })
      }
      rafRef.current = requestAnimationFrame(breathe)
    }
    rafRef.current = requestAnimationFrame(breathe)

    return () => {
      sim.stop()
      cancelAnimationFrame(rafRef.current)
    }
  }, [open, d3Ready, rebuildKey, impression]) // eslint-disable-line

  // ── Live update effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !d3Ready || !simRef.current || !liveModeRef.current || !!impression) return
    if (messages.length < 3) return

    const existingIds = new Set(nodesRef.current.map(n => n.id))
    const newMessages = messages.filter(m => !existingIds.has(m.id))
    if (!newMessages.length) return

    lastMsgTimeRef.current = Date.now()
    graphOpRef.current = 1.0

    const d3 = window.d3
    const HEIGHT = heightRef.current
    const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]))

    for (const msg of newMessages) {
      addLiveNode(d3, msg, nodeMap, HEIGHT)
    }

    // Node cap enforcement
    const activeCount = nodesRef.current.filter(n => !n._ghost).length
    if (activeCount > NODE_CAP) trimOldNodes(d3)

    setShape(detectShape(nodesRef.current, linksRef.current))
    simRef.current?.alpha(0.3).restart()
  }, [messages, liveMode]) // eslint-disable-line

  // ── Zoom level effect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !d3Ready || !svgRef.current || !zoomRef.current) return
    const d3 = window.d3
    const svg = d3.select(svgRef.current)
    const HEIGHT = heightRef.current

    if (zoomLevel === 1) {
      const nodes = nodesRef.current.filter(n => !n._ghost && n.x)
      if (nodes.length) {
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
        const minX = Math.min(...xs) - 24, maxX = Math.max(...xs) + 24
        const minY = Math.min(...ys) - 24, maxY = Math.max(...ys) + 24
        const scale = Math.min(WIDTH / (maxX - minX), HEIGHT / (maxY - minY)) * 0.85
        const tx = WIDTH / 2 - ((minX + maxX) / 2) * scale
        const ty = HEIGHT / 2 - ((minY + maxY) / 2) * scale
        svg.transition().duration(600).call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
      }
      nodeGroupRef.current?.selectAll('.node-label').attr('opacity', 0)
      nodeGroupRef.current?.selectAll('.node-preview').attr('opacity', 0)
      nodeGroupRef.current?.selectAll('g').each(function() {
        d3.select(this).select('circle,rect,polygon').attr('transform', 'scale(0.8)')
      })
    } else if (zoomLevel === 2) {
      svg.transition().duration(600).call(zoomRef.current.transform, d3.zoomIdentity)
      nodeGroupRef.current?.selectAll('.node-label').attr('opacity', 1)
      nodeGroupRef.current?.selectAll('.node-preview').attr('opacity', 0)
      nodeGroupRef.current?.selectAll('g').each(function() {
        d3.select(this).select('circle,rect,polygon').attr('transform', 'scale(1)')
      })
    } else if (zoomLevel === 3) {
      svg.transition().duration(600).call(zoomRef.current.transform, d3.zoomIdentity.scale(1.8))
      nodeGroupRef.current?.selectAll('.node-label').attr('opacity', 1)
      nodeGroupRef.current?.selectAll('.node-preview').attr('opacity', 0.7)
      nodeGroupRef.current?.selectAll('g').each(function() {
        d3.select(this).select('circle,rect,polygon').attr('transform', 'scale(1)')
      })
    }
  }, [zoomLevel, open, d3Ready]) // eslint-disable-line

  // ── Minimap click → pan ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = minimapRef.current
    if (!canvas) return
    function onMinimapClick(e) {
      if (!zoomRef.current || !svgRef.current || !d3Ready) return
      const d3 = window.d3
      const rect = canvas.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / 80
      const my = (e.clientY - rect.top) / 60
      const HEIGHT = heightRef.current
      const targetX = mx * WIDTH, targetY = my * HEIGHT
      const t = currentXfRef.current || d3.zoomIdentity
      d3.select(svgRef.current).transition().duration(300)
        .call(zoomRef.current.transform,
          d3.zoomIdentity.translate(WIDTH / 2 - targetX * t.k, HEIGHT / 2 - targetY * t.k).scale(t.k))
    }
    canvas.style.cursor = 'crosshair'
    canvas.addEventListener('click', onMinimapClick)
    return () => canvas.removeEventListener('click', onMinimapClick)
  }, [d3Ready])

  // ── addLiveNode ─────────────────────────────────────────────────────────────
  function addLiveNode(d3, msg, nodeMap, HEIGHT) {
    const sim = simRef.current
    if (!sim || !nodeGroupRef.current) return
    const isSocra = msg.role === 'socra'
    const baseR = msg.role === 'human' ? 7 : (msg.isReaction ? 5 : 9)
    const n = {
      id: msg.id, role: msg.role || 'human',
      content: msg.content || '', display_name: msg.display_name || msg.role,
      created_at: msg.created_at, replyToId: msg.replyToId || null,
      isReaction: msg.isReaction || false, isCrossReaction: msg.isCrossReaction || false,
      r: baseR, _r: baseR,
    }

    if (isSocra) {
      n.x = WIDTH / 2; n.y = HEIGHT / 2
    } else {
      const cluster = nodesRef.current.filter(nd => nd.role === msg.role && !nd._ghost)
      const sourceNode = msg.replyToId ? nodeMap.get(msg.replyToId) : null
      let ex = WIDTH / 2
      if (cluster.length) ex = cluster.reduce((s, nd) => s + nd.x, 0) / cluster.length
      else if (sourceNode) ex = sourceNode.x
      n.x = Math.max(20, Math.min(WIDTH - 20, ex)) + (Math.random() - 0.5) * 30
      n.y = 0
    }

    const inbound = linksRef.current.filter(l => {
      const t = typeof l.target === 'object' ? l.target.id : l.target
      return t === n.id
    }).length
    n._r = n.r + Math.min(inbound * 1.5, 6)

    nodesRef.current = [...nodesRef.current, n]
    nodeMap.set(n.id, n)

    let newLinkEl = null
    if (n.replyToId && nodeMap.has(n.replyToId)) {
      let type = 'reply'
      if (n.isCrossReaction)        type = 'tension'
      else if (n.role === 'contrarian') type = 'tension'
      else if (n.role === 'advocate')   type = 'approval'
      const newLink = { source: n.replyToId, target: n.id, type }
      linksRef.current = [...linksRef.current, newLink]
      newLinkEl = linkGroupRef.current.append('path')
        .datum(newLink)
        .attr('fill', 'none')
        .attr('stroke', (EDGE_STYLE[type] || EDGE_STYLE.reply).stroke)
        .attr('stroke-width', (EDGE_STYLE[type] || EDGE_STYLE.reply).width)
        .attr('stroke-dasharray', (EDGE_STYLE[type] || EDGE_STYLE.reply).dash)
        .attr('marker-end', `url(#arr-${type})`)
        .attr('opacity', 0)
      linkPathsRef.current = linkGroupRef.current.selectAll('path')
    }

    const newNodeEl = nodeGroupRef.current.append('g').datum(n).style('cursor', 'pointer').attr('opacity', 0)
    drawShape(d3, newNodeEl, n)
    attachInteractions(d3, newNodeEl)
    nodeElsRef.current = nodeGroupRef.current.selectAll('g')

    sim.nodes(nodesRef.current.filter(nd => !nd._ghost))
    sim.force('link').links(linksRef.current)

    if (newLinkEl) newLinkEl.transition().duration(400).attr('opacity', 0.65)

    if (isSocra) {
      newNodeEl.transition().duration(600).attr('opacity', 1)
      doSocraDrift(d3, n, nodesRef.current, sim)
    } else {
      let startTs = null
      function animateArrival(ts) {
        if (!startTs) startTs = ts
        const p = Math.min((ts - startTs) / 800, 1)
        newNodeEl.attr('opacity', 1 - Math.pow(1 - p, 3))
        if (p < 1) { requestAnimationFrame(animateArrival); return }
        emitRipple(d3, n)
        shiftAdjacent(nodesRef.current, n, 4)
        if (msg.role === 'scribe' && msg.approvedByStewId) doStewardApproval(d3, n, nodesRef.current, newLinkEl)
        if (n.role === 'contrarian') doContrarianTension(d3, n, newLinkEl, nodesRef.current)
        const now = Date.now()
        if (n.role === 'advocate') { divideRef.current.adv = now; divideRef.current.advNode = n }
        if (n.role === 'contrarian') { divideRef.current.contr = now; divideRef.current.contrNode = n }
        const { adv, contr, advNode, contrNode } = divideRef.current
        if (adv && contr && Math.abs(adv - contr) < 3000 && advNode && contrNode) {
          doRoomDivides(d3, advNode, contrNode)
          divideRef.current = { adv: 0, contr: 0, advNode: null, contrNode: null }
        }
      }
      requestAnimationFrame(animateArrival)
    }
  }

  // ── trimOldNodes ────────────────────────────────────────────────────────────
  function trimOldNodes(d3) {
    const active = nodesRef.current.filter(n => !n._ghost)
    const toRemove = active.slice(0, NODE_TRIM)
    const removeIds = new Set(toRemove.map(n => n.id))
    for (const n of toRemove) n._ghost = true
    for (const l of linksRef.current) {
      const src = typeof l.source === 'object' ? l.source.id : l.source
      const tgt = typeof l.target === 'object' ? l.target.id : l.target
      if (removeIds.has(src) || removeIds.has(tgt)) l._ghost = true
    }
    const ghostCount = nodesRef.current.filter(n => n._ghost).length
    setHiddenCount(ghostCount)
    simRef.current?.nodes(nodesRef.current.filter(n => !n._ghost))
    nodeGroupRef.current?.selectAll('g').each(function(d) {
      if (removeIds.has(d.id)) d3.select(this).attr('opacity', 0).style('pointer-events', 'none')
    })
    linkGroupRef.current?.selectAll('path').each(function(d) {
      if (d._ghost) d3.select(this).attr('opacity', 0.1).attr('stroke-dasharray', '2,4')
    })
    // Ghost edge click: show "Earlier in conversation" preview
    linkGroupRef.current?.selectAll('path').filter(d => d._ghost).on('click', function(event, d) {
      event.stopPropagation()
      const tgt = typeof d.target === 'object' ? d.target : nodesRef.current.find(n => n.id === d.target)
      if (tgt) setDetail({ ...tgt, _ghostPreview: true })
    })
  }

  // ── Animation helpers ───────────────────────────────────────────────────────

  function attachInteractions(d3, sel) {
    sel
      .on('mouseenter', function() {
        d3.select(this).select('circle,rect,polygon').attr('opacity', 1).attr('transform', 'scale(1.18)')
      })
      .on('mouseleave', function() {
        d3.select(this).select('circle,rect,polygon').attr('opacity', 0.82).attr('transform', 'scale(1)')
      })
      .on('click', function(event, d) { event.stopPropagation(); setDetail(d) })
  }

  function makeSocraForce(nodes, W, H) {
    return () => {
      const cx = W / 2, cy = H / 2
      for (const n of nodes) {
        const dx = cx - n.x, dy = cy - n.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120 && dist > 0) { n.vx += dx * 0.022; n.vy += dy * 0.022 }
      }
    }
  }

  function emitRipple(d3, node) {
    if (!zoomContainerRef.current) return
    const r0 = node._r
    zoomContainerRef.current.append('circle')
      .attr('cx', node.x).attr('cy', node.y).attr('r', r0)
      .attr('fill', 'none')
      .attr('stroke', ROLE_CONFIG[node.role]?.color || '#fff')
      .attr('stroke-width', 1.5).attr('opacity', 0.3)
      .attr('pointer-events', 'none')
      .transition().duration(600).attr('r', r0 * 4).attr('opacity', 0).remove()
  }

  function shiftAdjacent(nodes, arrived, amt) {
    for (const n of nodes) {
      if (n.id === arrived.id || n._ghost) continue
      const dx = n.x - arrived.x, dy = n.y - arrived.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 100 && dist > 0) {
        n.vx += (dx / dist) * amt * 0.4; n.vy += (dy / dist) * amt * 0.4
        simRef.current?.alpha(0.1).restart()
        setTimeout(() => { n.vx -= (dx / dist) * amt * 0.4; n.vy -= (dy / dist) * amt * 0.4 }, 400)
      }
    }
  }

  function doSocraDrift(d3, socraN, allNodes, sim) {
    const cx = socraN.x, cy = socraN.y
    const start = Date.now()
    sim.force('socraDrift', () => {
      const decay = Math.max(0, 1 - (Date.now() - start) / 3000)
      if (decay === 0) { sim.force('socraDrift', null); return }
      for (const n of allNodes) {
        if (n.id === socraN.id || n._ghost) continue
        const dx = cx - n.x, dy = cy - n.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150 && dist > 0) { n.vx += (dx / dist) * 0.08 * decay; n.vy += (dy / dist) * 0.08 * decay }
      }
    })
    sim.alpha(0.3).restart()
  }

  function doContrarianTension(d3, contrN, linkEl, allNodes) {
    if (linkEl) {
      let count = 0
      function pulse() {
        if (count >= 3) { linkEl.attr('stroke-width', 1); return }
        count++
        linkEl.transition().duration(200).attr('stroke-width', 4)
          .transition().duration(200).attr('stroke-width', 1.5).on('end', pulse)
      }
      pulse()
    }
    const targetNode = allNodes.find(n => n.id === contrN.replyToId)
    if (targetNode) {
      const sim = simRef.current
      targetNode.vx += 3; sim?.alpha(0.1).restart()
      setTimeout(() => { targetNode.vx -= 6; sim?.alpha(0.05).restart() }, 150)
      setTimeout(() => { targetNode.vx += 6; sim?.alpha(0.05).restart() }, 300)
      setTimeout(() => { targetNode.vx -= 3 }, 450)
    }
    const arcTargets = allNodes.filter(n => (n.role === 'claude' || n.role === 'gpt') && !n._ghost)
    if (!zoomContainerRef.current) return
    arcTargets.forEach(target => {
      zoomContainerRef.current.append('path')
        .attr('fill', 'none').attr('stroke', '#607080').attr('stroke-width', 1)
        .attr('opacity', 0.15).attr('pointer-events', 'none')
        .attr('d', () => {
          const mx = (contrN.x + target.x) / 2, my = (contrN.y + target.y) / 2
          const dx = target.x - contrN.x, dy = target.y - contrN.y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          return `M ${contrN.x} ${contrN.y} Q ${mx - (dy / len) * 20} ${my + (dx / len) * 20} ${target.x} ${target.y}`
        })
        .transition().duration(1500).attr('opacity', 0).remove()
    })
  }

  function doStewardApproval(d3, scribeN, allNodes, approvalLinkEl) {
    const stewardN = allNodes.find(n => n.role === 'steward')
    if (!stewardN || !nodeGroupRef.current || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    const stewardEl = nodeGroupRef.current.selectAll('g').filter(d => d?.id === stewardN.id)
    if (!stewardEl.empty()) {
      const fid = `ng-stw-pulse-${Date.now()}`
      const f = svg.select('defs').append('filter').attr('id', fid)
        .attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
      f.append('feGaussianBlur').attr('stdDeviation', '14').attr('result', 'blur')
      const fm = f.append('feMerge')
      fm.append('feMergeNode').attr('in', 'blur')
      fm.append('feMergeNode').attr('in', 'SourceGraphic')
      stewardEl.select('rect').attr('filter', `url(#${fid})`)
        .transition().duration(400).attr('opacity', 1)
        .transition().duration(800).attr('opacity', 0.82)
        .on('end', () => { stewardEl.select('rect').attr('filter', 'url(#ng-steward)'); svg.select(`#${fid}`).remove() })
    }
    if (approvalLinkEl) {
      try {
        const length = approvalLinkEl.node().getTotalLength?.() || 160
        approvalLinkEl.attr('stroke-dasharray', length).attr('stroke-dashoffset', length).attr('opacity', 0.7)
          .transition().duration(600).attr('stroke-dashoffset', 0)
          .on('end', () => approvalLinkEl.attr('stroke-dasharray', null))
      } catch (_) {}
    }
    const scribeEl = nodeGroupRef.current.selectAll('g').filter(d => d?.id === scribeN.id)
    if (!scribeEl.empty()) {
      scribeEl.select('circle').attr('fill', '#4080c0').attr('opacity', 1)
        .transition().duration(1000).attr('opacity', 0.6)
        .transition().duration(800).attr('fill', ROLE_CONFIG.scribe.color).attr('opacity', 0.82)
    }
  }

  function doRoomDivides(d3, advN, contrN) {
    const target = nodesRef.current.find(n => n.id === (advN.replyToId || contrN.replyToId))
    const baseX = target?.x || WIDTH / 2
    const baseY = target?.y || heightRef.current / 2
    advN.fx = baseX - 55; advN.fy = baseY
    contrN.fx = baseX + 55; contrN.fy = baseY
    setTimeout(() => { advN.fx = null; advN.fy = null; contrN.fx = null; contrN.fy = null }, 700)
    simRef.current?.alpha(0.4).restart()
    if (!zoomContainerRef.current || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    const divEdge = zoomContainerRef.current.append('path')
      .attr('fill', 'none').attr('stroke', 'url(#ng-divide-grad)')
      .attr('stroke-width', 1.5).attr('opacity', 0).attr('pointer-events', 'none')
    divEdge.transition().duration(400).attr('opacity', 0.4)
    let pulseId
    const pulseStart = performance.now()
    function pulseDivide(ts) {
      const t = ts - pulseStart
      divEdge.attr('opacity', 0.275 + Math.sin(t / 1000) * 0.125)
      divEdge.attr('d', () => {
        const mx = (advN.x + contrN.x) / 2, my = (advN.y + contrN.y) / 2
        const dx = contrN.x - advN.x, dy = contrN.y - advN.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        return `M ${advN.x} ${advN.y} Q ${mx - (dy / len) * 20} ${my + (dx / len) * 20} ${contrN.x} ${contrN.y}`
      })
      svg.select('#ng-divide-grad').attr('x1', advN.x).attr('y1', advN.y).attr('x2', contrN.x).attr('y2', contrN.y)
      const hasReply = (nid) => linksRef.current.some(l => {
        const t = typeof l.target === 'object' ? l.target.id : l.target
        return t === nid
      })
      if (hasReply(advN.id) || hasReply(contrN.id)) {
        divEdge.transition().duration(600).attr('opacity', 0).remove(); return
      }
      pulseId = requestAnimationFrame(pulseDivide)
    }
    pulseId = requestAnimationFrame(pulseDivide)
  }

  function updateMinimap() {
    const canvas = minimapRef.current
    if (!canvas) return
    const nodes = nodesRef.current
    const ctx = canvas.getContext('2d')
    const W = 80, H = 60
    const svgW = WIDTH, svgH = heightRef.current
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(8,7,6,0.88)'
    ctx.fillRect(0, 0, W, H)
    for (const n of nodes) {
      if (n._ghost || n.x == null) continue
      ctx.beginPath()
      ctx.arc((n.x / svgW) * W, (n.y / svgH) * H, 2, 0, Math.PI * 2)
      ctx.fillStyle = ROLE_CONFIG[n.role]?.color || '#888'
      ctx.globalAlpha = 0.72
      ctx.fill()
    }
    ctx.globalAlpha = 1
    // Viewport rect
    const t = currentXfRef.current
    if (t && t.k) {
      const rx = (-t.x / t.k) * (W / svgW)
      const ry = (-t.y / t.k) * (H / svgH)
      const rw = (svgW / t.k) * (W / svgW)
      const rh = (svgH / t.k) * (H / svgH)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(rx, ry, rw, rh)
    }
    // Hidden node count indicator
    const ghostCount = nodes.filter(n => n._ghost).length
    if (ghostCount > 0) {
      ctx.fillStyle = 'rgba(200,160,96,0.8)'
      ctx.font = 'bold 7px monospace'
      ctx.fillText(`+${ghostCount}`, 4, 10)
    }
  }

  function handleLiveToggle() {
    if (liveMode) {
      setLiveMode(false)
      setSnapshotTime(new Date())
    } else {
      setLiveMode(true)
      setSnapshotTime(null)
      setRebuildKey(k => k + 1)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null

  const isImpression = !!impression
  const isEmpty = isImpression
    ? (impression?.snapshot?.nodes?.length || 0) < 3
    : messages.length < 3

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: WIDTH, height: '100vh',
      background: 'rgba(8,7,6,0.94)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderLeft: isImpression ? '1px solid rgba(200,160,80,0.45)' : '1px solid var(--border)',
      zIndex: isImpression ? 9100 : 2000, display: 'flex', flexDirection: 'column',
      animation: 'neuronSlideIn 0.28s var(--ease, cubic-bezier(.4,0,.2,1))',
    }}>

      {/* Header */}
      <div style={{ height: 44, padding: '0 1rem', borderBottom: `1px solid ${isImpression ? 'rgba(200,160,80,0.2)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: isImpression ? 'rgba(200,160,80,0.75)' : 'rgba(200,160,96,0.75)', flexShrink: 0 }} />
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '.18em', textTransform: 'uppercase', color: isImpression ? 'rgba(200,160,80,0.75)' : 'var(--mid)' }}>
              {isImpression ? 'The Impression' : 'The Neuron'}
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '2px', color: isEmpty ? 'transparent' : (isImpression ? 'rgba(200,160,80,0.55)' : 'var(--ember)'), transition: 'color .4s' }}>
              {isImpression ? (impression?.buildSummary || '').slice(0, 40) : shape}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
          {/* Zoom tabs */}
          {[{ k: 1, label: 'ALL' }, { k: 2, label: 'MAP' }, { k: 3, label: 'READ' }].map(({ k, label }) => (
            <button key={k} onClick={() => setZoomLevel(k)} data-hover
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.1em',
                background: zoomLevel === k ? (isImpression ? 'rgba(200,160,80,0.08)' : 'rgba(196,78,24,0.08)') : 'transparent',
                border: `1px solid ${zoomLevel === k ? (isImpression ? 'rgba(200,160,80,0.4)' : 'rgba(196,78,24,0.5)') : '#2e2b27'}`,
                borderRadius: '3px', padding: '.2rem .45rem', cursor: 'none',
                color: zoomLevel === k ? (isImpression ? 'rgba(200,160,80,0.85)' : 'var(--ember)') : '#3a3530', transition: 'all .15s',
              }}>
              {label}
            </button>
          ))}
          <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
          {isImpression ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.42rem', letterSpacing: '.08em', color: 'rgba(200,160,80,0.5)', whiteSpace: 'nowrap' }}>
                {formatImpressionDate(impression?.snapshot?.capturedAt)}
              </span>
              <button
                onClick={onClose}
                style={{ background: 'none', border: '1px solid rgba(200,160,80,0.25)', borderRadius: '3px', padding: '.2rem .45rem', cursor: 'pointer', color: 'rgba(200,160,80,0.55)', fontFamily: 'var(--font-mono)', fontSize: '10px', transition: 'all .15s' }}>
                ✕
              </button>
            </>
          ) : (
            <>
              {!liveMode && snapshotTime && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.38rem', letterSpacing: '.05em', color: 'var(--muted)', opacity: .55 }}>
                  {snapshotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={handleLiveToggle} data-hover
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase',
                  background: liveMode ? 'rgba(212,84,26,0.06)' : 'transparent',
                  border: `1px solid ${liveMode ? 'rgba(212,84,26,0.4)' : '#2e2b27'}`,
                  borderRadius: '3px', padding: '.2rem .5rem', cursor: 'none',
                  color: liveMode ? 'var(--ember)' : '#3a3530',
                  display: 'flex', alignItems: 'center', gap: '.35rem', transition: 'all .2s',
                }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: liveMode ? 'var(--ember)' : '#3a3530',
                  animation: liveMode ? 'neuronLivePulse 1.6s ease-in-out infinite' : 'none',
                }} />
                {liveMode ? 'LIVE' : 'PAUSED'}
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.45rem', color: 'var(--muted)', opacity: .6 }}>{messages.length}</span>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3530', fontSize: 20, lineHeight: 1, padding: '2px 6px', transition: 'color 0.15s' }}
                onMouseEnter={e => e.target.style.color = '#6a6460'}
                onMouseLeave={e => e.target.style.color = '#3a3530'}>
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legend bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.4rem',
        padding: '.5rem 1rem', borderBottom: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.25)', flexShrink: 0,
        opacity: isEmpty ? 0.25 : 1, transition: 'opacity .4s',
      }}>
        {[
          { label: 'REPLY',    stroke: EDGE_STYLE.reply.stroke,    dash: '',    color: 'rgba(255,255,255,0.55)' },
          { label: 'TENSION',  stroke: EDGE_STYLE.tension.stroke,  dash: '4,3', color: 'rgba(255,96,96,0.8)'   },
          { label: 'APPROVAL', stroke: EDGE_STYLE.approval.stroke, dash: '2,4', color: 'rgba(80,200,100,0.8)' },
        ].map(e => (
          <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <svg width={26} height={8} style={{ flexShrink: 0 }}>
              <line x1={0} y1={4} x2={26} y2={4} stroke={e.stroke} strokeWidth={1.5} strokeDasharray={e.dash} />
            </svg>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '.1em', color: e.color, textTransform: 'uppercase' }}>
              {e.label}
            </span>
          </div>
        ))}
      </div>

      {/* Graph area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%', filter: isImpression ? 'saturate(0.82)' : 'none' }} />

        {/* Empty state */}
        {isEmpty && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: '1rem',
            pointerEvents: 'none',
          }}>
            {/* Compass rose — slow rotate at 8% opacity */}
            <div style={{ position: 'absolute', opacity: 0.08, animation: 'neuronCompassSpin 32s linear infinite' }}>
              <svg width={160} height={160} viewBox="0 0 100 100" fill="none">
                <circle cx={50} cy={50} r={46} stroke="#c8a060" strokeWidth={0.5} strokeDasharray="2,4"/>
                <circle cx={50} cy={50} r={30} stroke="#c8a060" strokeWidth={0.5}/>
                <circle cx={50} cy={50} r={3} fill="#c8a060"/>
                {/* Cardinal spokes */}
                {[0,90,180,270].map(a => {
                  const rad = a * Math.PI / 180
                  const x1 = 50 + Math.cos(rad) * 6, y1 = 50 + Math.sin(rad) * 6
                  const x2 = 50 + Math.cos(rad) * 44, y2 = 50 + Math.sin(rad) * 44
                  const tipL = { x: 50 + Math.cos(rad - 0.18) * 36, y: 50 + Math.sin(rad - 0.18) * 36 }
                  const tipR = { x: 50 + Math.cos(rad + 0.18) * 36, y: 50 + Math.sin(rad + 0.18) * 36 }
                  return (
                    <g key={a}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8a060" strokeWidth={0.6}/>
                      <polygon points={`${x2},${y2} ${tipL.x},${tipL.y} ${tipR.x},${tipR.y}`} fill="#c8a060"/>
                    </g>
                  )
                })}
                {/* Ordinal spokes */}
                {[45,135,225,315].map(a => {
                  const rad = a * Math.PI / 180
                  const x1 = 50 + Math.cos(rad) * 8, y1 = 50 + Math.sin(rad) * 8
                  const x2 = 50 + Math.cos(rad) * 38, y2 = 50 + Math.sin(rad) * 38
                  return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c8a060" strokeWidth={0.4}/>
                })}
              </svg>
            </div>
            {/* Text */}
            <div style={{ animation: 'neuronEmptyBreathe 5s ease-in-out infinite', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                fontSize: '15px', color: '#5a5248', lineHeight: 1.75,
                letterSpacing: '0.01em',
              }}>
                {isImpression
                  ? <>This thought topology<br />was sealed.</>
                  : <>The conversation hasn't<br />taken shape yet.</>}
              </p>
              <p style={{
                fontFamily: 'monospace', fontSize: '9px', letterSpacing: '.18em',
                textTransform: 'uppercase', color: '#3a3530', marginTop: '.7rem',
              }}>
                {isImpression ? 'No topology recorded.' : 'Keep thinking.'}
              </p>
            </div>
          </div>
        )}

        {/* D3 loading */}
        {!d3Ready && !isEmpty && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.5rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted)' }}>loading graph…</span>
          </div>
        )}

        {/* Minimap */}
        <canvas ref={minimapRef} width={80} height={60}
          style={{ position: 'absolute', bottom: 12, right: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, opacity: isEmpty ? 0 : 0.75 }} />

        {/* Hidden node count badge */}
        {hiddenCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 80, right: 12,
            fontFamily: 'var(--font-mono)', fontSize: '.4rem', letterSpacing: '.08em', textTransform: 'uppercase',
            color: 'rgba(200,160,96,0.7)', background: 'rgba(8,7,6,0.8)',
            border: '1px solid rgba(200,160,96,0.2)', borderRadius: '2px', padding: '.2rem .4rem',
          }}>
            +{hiddenCount} earlier
          </div>
        )}
      </div>

      {/* Impression agents footer */}
      {isImpression && impression?.snapshot?.agentsPresent?.length > 0 && (
        <div style={{ padding: '.45rem 1rem', borderTop: '1px solid rgba(200,160,80,0.12)', background: 'rgba(200,160,80,0.03)', display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(200,160,80,0.35)', marginRight: '.25rem' }}>AGENTS</span>
          {impression.snapshot.agentsPresent.map(role => (
            <span key={role} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', color: ROLE_CONFIG[role]?.color || 'rgba(255,255,255,0.4)', opacity: 0.7 }}>
              {ROLE_CONFIG[role]?.label || role}
            </span>
          ))}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '.1em', color: 'rgba(200,160,80,0.3)', marginLeft: 'auto' }}>
            {impression.snapshot.messageCount} msgs
          </span>
        </div>
      )}

      {/* Detail panel */}
      {detail && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 168,
          background: 'rgba(14,12,10,0.98)', borderTop: '1px solid var(--border)',
          padding: '.8rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <div style={{ width: 5, height: 5, borderRadius: detail.role === 'contrarian' ? 0 : '50%', background: ROLE_CONFIG[detail.role]?.color || 'var(--muted)', transform: detail.role === 'contrarian' ? 'rotate(45deg)' : 'none' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.5rem', letterSpacing: '.12em', textTransform: 'uppercase', color: ROLE_CONFIG[detail.role]?.color || 'var(--text)' }}>
                {detail._ghostPreview ? 'Earlier in conversation' : detail.display_name}
              </span>
            </div>
            <button onClick={() => setDetail(null)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '.55rem', cursor: 'none', padding: '.1rem .3rem', lineHeight: 1 }}>
              ✕
            </button>
          </div>
          <p style={{
            fontFamily: 'var(--font-caveat)', fontSize: '.95rem', color: detail._ghostPreview ? 'var(--muted)' : 'var(--mid)',
            lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', marginBottom: '.55rem',
            fontStyle: detail._ghostPreview ? 'italic' : 'normal',
          }}>
            {detail.content}
          </p>
          {!detail._ghostPreview && (
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
          )}
        </div>
      )}
    </div>
  )
}
