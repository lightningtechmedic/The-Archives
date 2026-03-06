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
  g.append('text')
    .attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-family', 'var(--font-mono)')
    .attr('font-size', Math.max((d._r || d.r) * 0.72, 6))
    .attr('fill', 'rgba(0,0,0,0.72)')
    .attr('pointer-events', 'none')
    .text(cfg.label[0])
}

function setNodeRadius(d3, g, d, r) {
  if (d.role === 'steward') {
    g.select('rect').attr('x', -(r + 1)).attr('y', -(r + 1)).attr('width', (r + 1) * 2).attr('height', (r + 1) * 2)
  } else if (d.role === 'contrarian') {
    const s = r + 2
    g.select('polygon').attr('points', `0,${-s} ${s},0 0,${s} ${-s},0`)
  } else {
    g.select('circle').attr('r', r)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Neuron({ messages, open, onScrollToMessage }) {
  // ── Refs ──
  const svgRef        = useRef(null)
  const minimapRef    = useRef(null)
  const simRef        = useRef(null)
  const nodesRef      = useRef([])
  const linksRef      = useRef([])
  const nodeGroupRef  = useRef(null)   // D3 sel: <g> containing all node <g>
  const linkGroupRef  = useRef(null)   // D3 sel: <g> containing all edge paths
  const nodeElsRef    = useRef(null)   // D3 sel: current node elements (for RAF)
  const linkPathsRef  = useRef(null)   // D3 sel: current base edge paths (for RAF)
  const rafRef        = useRef(null)
  const breathStartRef  = useRef(0)
  const lastMsgTimeRef  = useRef(Date.now())
  const graphOpRef      = useRef(1)
  const prevMsgLenRef   = useRef(0)
  const divideRef       = useRef({ adv: 0, contr: 0, advNode: null, contrNode: null })
  const liveModeRef     = useRef(true)

  // ── State ──
  const [detail, setDetail]             = useState(null)
  const [d3Ready, setD3Ready]           = useState(false)
  const [liveMode, setLiveMode]         = useState(true)
  const [snapshotTime, setSnapshotTime] = useState(null)
  const [rebuildKey, setRebuildKey]     = useState(0)

  // Sync liveMode to ref (for use inside async callbacks)
  useEffect(() => { liveModeRef.current = liveMode }, [liveMode])

  // ── Keyframe inject ──
  useEffect(() => {
    if (document.getElementById('neuron-kf')) return
    const s = document.createElement('style')
    s.id = 'neuron-kf'
    s.textContent = '@keyframes neuronSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}'
    document.head.appendChild(s)
  }, [])

  // ── D3 ready poll ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.d3) { setD3Ready(true); return }
    const id = setInterval(() => { if (window.d3) { setD3Ready(true); clearInterval(id) } }, 100)
    return () => clearInterval(id)
  }, [])

  // ── Main build ─────────────────────────────────────────────────────────────
  // Deps: open, d3Ready, rebuildKey — NOT messages (handled by live update effect)
  useEffect(() => {
    if (!open || !d3Ready || !svgRef.current) return
    const d3 = window.d3
    const HEIGHT = svgRef.current.parentElement?.clientHeight || window.innerHeight - 44

    if (simRef.current) { simRef.current.stop(); simRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    d3.select(svgRef.current).selectAll('*').remove()

    // Snapshot of messages at build time
    const msgSnap = messages

    // Build node/link data
    const nodeMap = new Map()
    const nodes = msgSnap.map(m => {
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

    // Influence sizing
    const influence = new Map()
    for (const l of links) {
      const t = typeof l.target === 'object' ? l.target.id : l.target
      influence.set(t, (influence.get(t) || 0) + 1)
    }
    for (const n of nodes) n._r = n.r + Math.min((influence.get(n.id) || 0) * 1.5, 6)

    prevMsgLenRef.current = msgSnap.length
    divideRef.current = { adv: 0, contr: 0, advNode: null, contrNode: null }

    // SVG
    const svg = d3.select(svgRef.current).attr('width', WIDTH).attr('height', HEIGHT)

    // Defs: glow filters + Room Divides gradient
    const defs = svg.append('defs')
    Object.keys(ROLE_CONFIG).forEach(role => {
      const f = defs.append('filter').attr('id', `ng-${role}`)
        .attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%')
      f.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur')
      const fm = f.append('feMerge')
      fm.append('feMergeNode').attr('in', 'blur')
      fm.append('feMergeNode').attr('in', 'SourceGraphic')
    })
    const grad = defs.append('linearGradient').attr('id', 'ng-divide-grad')
      .attr('gradientUnits', 'userSpaceOnUse')
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#b8856a')  // brass advocate side
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#c44e18') // ember contrarian side

    // Socra field
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
    const linkG = svg.append('g')
    linkGroupRef.current = linkG
    const linkPaths = linkG.selectAll('path').data(links).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).stroke)
      .attr('stroke-width', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).width)
      .attr('stroke-dasharray', d => (EDGE_STYLE[d.type] || EDGE_STYLE.reply).dash)
      .attr('opacity', 0.65)
    linkPathsRef.current = linkPaths

    // Nodes
    const nodeG = svg.append('g')
    nodeGroupRef.current = nodeG
    const nodeEls = nodeG.selectAll('g').data(nodes).enter().append('g').style('cursor', 'pointer')
    nodeEls.each(function(d) { drawShape(d3, d3.select(this), d) })
    attachInteractions(d3, nodeEls)
    nodeElsRef.current = nodeEls

    // Simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(72).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-95))
      .force('center', d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('collide', d3.forceCollide(d => d._r + 5))
    sim.force('socra', makeSocraForce(nodes, WIDTH, HEIGHT))
    simRef.current = sim

    function tick() {
      const all = nodesRef.current
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
      updateMinimap(nodesRef.current, WIDTH, HEIGHT)
    }
    sim.on('tick', tick)

    const drag = d3.drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    nodeEls.call(drag)

    // ── Breathing RAF ──
    breathStartRef.current = performance.now()

    function breathe(ts) {
      if (!svgRef.current) return
      const t = ts - breathStartRef.current
      const silentMs = Date.now() - lastMsgTimeRef.current
      const isSilent = silentMs > 90000
      const divisor = isSilent ? 6000 : 3000

      // Silence dimming — drift opacity over ~200 frames
      const targetOp = isSilent ? 0.6 : 1.0
      graphOpRef.current += (targetOp - graphOpRef.current) * (isSilent ? 0.004 : 0.04)
      if (Math.abs(graphOpRef.current - targetOp) > 0.002) {
        d3.select(svgRef.current).attr('opacity', graphOpRef.current)
      }

      // Node breathing — per node, staggered phase
      if (nodeElsRef.current) {
        let i = 0
        nodeElsRef.current.each(function(d) {
          const breathAmt = Math.sin(t / divisor + i * 0.4) * 1.2
          setNodeRadius(d3, d3.select(this), d, (d._r || d.r) + breathAmt)
          i++
        })
      }

      // Edge opacity breathing (base edges only, skip custom-pinned ones)
      if (linkPathsRef.current) {
        const edgeOp = 0.35 + Math.sin(t / divisor) * 0.08
        linkPathsRef.current.each(function(d) {
          if (!d?._pinOpacity) d3.select(this).attr('opacity', edgeOp + 0.3)
        })
      }

      rafRef.current = requestAnimationFrame(breathe)
    }
    rafRef.current = requestAnimationFrame(breathe)

    return () => {
      sim.stop()
      cancelAnimationFrame(rafRef.current)
    }
  }, [open, d3Ready, rebuildKey]) // eslint-disable-line

  // ── Live update effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !d3Ready || !simRef.current) return
    const newMsgs = messages.slice(prevMsgLenRef.current)
    if (!newMsgs.length) return

    // Restore from silence on any new message
    lastMsgTimeRef.current = Date.now()
    graphOpRef.current = 1.0

    if (!liveModeRef.current) {
      // In paused mode: just advance the cursor so we don't double-process on resume
      prevMsgLenRef.current = messages.length
      return
    }

    const d3 = window.d3
    const HEIGHT = svgRef.current?.parentElement?.clientHeight || 600
    const nodeMap = new Map(nodesRef.current.map(n => [n.id, n]))

    for (const msg of newMsgs) {
      if (nodeMap.has(msg.id)) continue
      addLiveNode(d3, msg, nodeMap, HEIGHT)
    }
    prevMsgLenRef.current = messages.length
  }, [messages]) // eslint-disable-line

  // ── addLiveNode ─────────────────────────────────────────────────────────────
  function addLiveNode(d3, msg, nodeMap, HEIGHT) {
    const sim = simRef.current
    if (!sim || !svgRef.current || !nodeGroupRef.current) return
    const isSocra = msg.role === 'socra'

    // Build node datum
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
      // Entry from top edge, nearest to source cluster centroid
      const clusterNodes = nodesRef.current.filter(nd => nd.role === msg.role)
      const sourceNode = msg.replyToId ? nodeMap.get(msg.replyToId) : null
      let entryX = WIDTH / 2
      if (clusterNodes.length > 0) {
        entryX = clusterNodes.reduce((s, nd) => s + nd.x, 0) / clusterNodes.length
      } else if (sourceNode) {
        entryX = sourceNode.x
      }
      n.x = Math.max(20, Math.min(WIDTH - 20, entryX)) + (Math.random() - 0.5) * 30
      n.y = 0
    }

    // Influence sizing
    const inboundCount = linksRef.current.filter(l => {
      const t = typeof l.target === 'object' ? l.target.id : l.target
      return t === n.id
    }).length
    n._r = n.r + Math.min(inboundCount * 1.5, 6)

    // Register in data structures
    nodesRef.current = [...nodesRef.current, n]
    nodeMap.set(n.id, n)

    // Build new link if applicable
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
        .attr('opacity', 0)
      linkPathsRef.current = linkGroupRef.current.selectAll('path')
    }

    // Add DOM node
    const newNodeEl = nodeGroupRef.current.append('g').datum(n).style('cursor', 'pointer')
    drawShape(d3, newNodeEl, n)
    attachInteractions(d3, newNodeEl)
    nodeElsRef.current = nodeGroupRef.current.selectAll('g')

    // Update simulation
    sim.nodes(nodesRef.current)
    sim.force('link').links(linksRef.current)
    sim.alpha(0.3).restart()

    // Fade in new link
    if (newLinkEl) newLinkEl.transition().duration(400).attr('opacity', 0.65)

    if (isSocra) {
      newNodeEl.attr('opacity', 0).transition().duration(600).attr('opacity', 1)
      doSocraDrift(d3, n, nodesRef.current, sim)
    } else {
      // Entry animation: fade + drift from entry edge
      newNodeEl.attr('opacity', 0)
      const targetX = n.x, targetY = n.y
      const startX = n.x, startY = n.y
      let startTs = null

      function animateArrival(ts) {
        if (!startTs) startTs = ts
        const p = Math.min((ts - startTs) / 800, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        newNodeEl.attr('opacity', ease)
        if (p < 1) { requestAnimationFrame(animateArrival); return }

        // Landed
        emitRipple(d3, svgRef.current, n)
        shiftAdjacent(nodesRef.current, n, 4)

        // Special: Steward approval
        if (msg.role === 'scribe' && msg.approvedByStewId) {
          doStewardApproval(d3, n, nodesRef.current, newLinkEl)
        }

        // Special: Contrarian tension
        if (n.role === 'contrarian') {
          doContrarianTension(d3, n, newLinkEl, nodesRef.current, svgRef.current)
        }

        // Room Divides tracking
        const now = Date.now()
        if (n.role === 'advocate') {
          divideRef.current.adv = now; divideRef.current.advNode = n
        } else if (n.role === 'contrarian') {
          divideRef.current.contr = now; divideRef.current.contrNode = n
        }
        const { adv, contr, advNode, contrNode } = divideRef.current
        if (adv && contr && Math.abs(adv - contr) < 3000 && advNode && contrNode) {
          doRoomDivides(d3, advNode, contrNode, svgRef.current)
          divideRef.current = { adv: 0, contr: 0, advNode: null, contrNode: null }
        }
      }
      requestAnimationFrame(animateArrival)
    }
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

  function emitRipple(d3, svgEl, node) {
    const r0 = node._r
    d3.select(svgEl).append('circle')
      .attr('cx', node.x).attr('cy', node.y).attr('r', r0)
      .attr('fill', 'none')
      .attr('stroke', ROLE_CONFIG[node.role]?.color || '#fff')
      .attr('stroke-width', 1.5).attr('opacity', 0.3)
      .attr('pointer-events', 'none')
      .transition().duration(600)
      .attr('r', r0 * 4).attr('opacity', 0)
      .remove()
  }

  function shiftAdjacent(nodes, arrivedNode, amt) {
    for (const n of nodes) {
      if (n.id === arrivedNode.id) continue
      const dx = n.x - arrivedNode.x, dy = n.y - arrivedNode.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 100 && dist > 0) {
        n.vx += (dx / dist) * amt * 0.4
        n.vy += (dy / dist) * amt * 0.4
        simRef.current?.alpha(0.1).restart()
        setTimeout(() => {
          n.vx -= (dx / dist) * amt * 0.4
          n.vy -= (dy / dist) * amt * 0.4
        }, 400)
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
        if (n.id === socraN.id) continue
        const dx = cx - n.x, dy = cy - n.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150 && dist > 0) {
          n.vx += (dx / dist) * 0.08 * decay
          n.vy += (dy / dist) * 0.08 * decay
        }
      }
    })
    sim.alpha(0.3).restart()
  }

  function doContrarianTension(d3, contrN, linkEl, allNodes, svgEl) {
    // Pulse edge stroke-width 3× (1.5 → 4 → 1.5)
    if (linkEl) {
      let count = 0
      function pulse() {
        if (count >= 3) { linkEl.attr('stroke-width', 1); return }
        count++
        linkEl.transition().duration(200).attr('stroke-width', 4)
          .transition().duration(200).attr('stroke-width', 1.5)
          .on('end', pulse)
      }
      pulse()
    }

    // Wobble target node via velocity impulse
    const targetNode = allNodes.find(n => n.id === contrN.replyToId)
    if (targetNode) {
      const sim = simRef.current
      targetNode.vx += 3; sim?.alpha(0.1).restart()
      setTimeout(() => { targetNode.vx -= 6; sim?.alpha(0.05).restart() }, 150)
      setTimeout(() => { targetNode.vx += 6; sim?.alpha(0.05).restart() }, 300)
      setTimeout(() => { targetNode.vx -= 3; sim?.alpha(0.05).restart() }, 450)
    }

    // Steel arc to all Architect/Spark nodes, fades in 1.5s
    const arcTargets = allNodes.filter(n => n.role === 'claude' || n.role === 'gpt')
    const svg = d3.select(svgEl)
    arcTargets.forEach(target => {
      svg.append('path')
        .attr('fill', 'none').attr('stroke', '#607080')
        .attr('stroke-width', 1).attr('opacity', 0.15)
        .attr('pointer-events', 'none')
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
    if (!stewardN || !nodeGroupRef.current) return
    const svg = d3.select(svgRef.current)

    // Steward node: brass glow pulse
    const stewardEl = nodeGroupRef.current.selectAll('g').filter(d => d?.id === stewardN.id)
    if (!stewardEl.empty()) {
      const filterId = `ng-stw-pulse-${Date.now()}`
      const f = svg.select('defs').append('filter').attr('id', filterId)
        .attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
      f.append('feGaussianBlur').attr('stdDeviation', '14').attr('result', 'blur')
      const fm = f.append('feMerge')
      fm.append('feMergeNode').attr('in', 'blur')
      fm.append('feMergeNode').attr('in', 'SourceGraphic')
      stewardEl.select('rect')
        .attr('filter', `url(#${filterId})`)
        .transition().duration(400).attr('opacity', 1)
        .transition().duration(800).attr('opacity', 0.82)
        .on('end', () => {
          stewardEl.select('rect').attr('filter', 'url(#ng-steward)')
          svg.select(`#${filterId}`).remove()
        })
    }

    // Self-drawing approval edge via stroke-dashoffset
    if (approvalLinkEl) {
      try {
        const pathEl = approvalLinkEl.node()
        const length = pathEl.getTotalLength?.() || 160
        approvalLinkEl
          .attr('stroke-dasharray', length).attr('stroke-dashoffset', length).attr('opacity', 0.7)
          .transition().duration(600).attr('stroke-dashoffset', 0)
          .on('end', () => approvalLinkEl.attr('stroke-dasharray', null))
      } catch (_) {}
    }

    // Scribe node: ink blue glow for 1s
    const scribeEl = nodeGroupRef.current.selectAll('g').filter(d => d?.id === scribeN.id)
    if (!scribeEl.empty()) {
      scribeEl.select('circle')
        .attr('fill', '#4080c0').attr('opacity', 1)
        .transition().duration(1000).attr('opacity', 0.6)
        .transition().duration(800)
        .attr('fill', ROLE_CONFIG.scribe.color).attr('opacity', 0.82)
    }
  }

  function doRoomDivides(d3, advN, contrN, svgEl) {
    const target = nodesRef.current.find(n => n.id === (advN.replyToId || contrN.replyToId))
    const baseX = target?.x || WIDTH / 2
    const baseY = target?.y || (svgEl.clientHeight / 2)

    // Force positions: advocate left, contrarian right
    advN.fx = baseX - 55; advN.fy = baseY
    contrN.fx = baseX + 55; contrN.fy = baseY
    setTimeout(() => { advN.fx = null; advN.fy = null; contrN.fx = null; contrN.fy = null }, 700)
    simRef.current?.alpha(0.4).restart()

    const svg = d3.select(svgEl)
    const divEdge = svg.append('path')
      .attr('fill', 'none').attr('stroke', 'url(#ng-divide-grad)')
      .attr('stroke-width', 1.5).attr('opacity', 0)
      .attr('pointer-events', 'none')
    divEdge.transition().duration(400).attr('opacity', 0.4)

    let pulseId
    let pulseStart = performance.now()

    function updateGradient() {
      svg.select('#ng-divide-grad')
        .attr('x1', advN.x).attr('y1', advN.y)
        .attr('x2', contrN.x).attr('y2', contrN.y)
    }

    function pulseDivide(ts) {
      const t = ts - pulseStart
      const op = 0.275 + Math.sin(t / 1000) * 0.125  // oscillates 0.15–0.4
      divEdge.attr('opacity', Math.max(0.1, op))
      divEdge.attr('d', () => {
        const mx = (advN.x + contrN.x) / 2, my = (advN.y + contrN.y) / 2
        const dx = contrN.x - advN.x, dy = contrN.y - advN.y
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        return `M ${advN.x} ${advN.y} Q ${mx - (dy / len) * 20} ${my + (dx / len) * 20} ${contrN.x} ${contrN.y}`
      })
      updateGradient()

      // Check if either node gained a reply (influence > 0)
      const check = (nid) => linksRef.current.some(l => {
        const t = typeof l.target === 'object' ? l.target.id : l.target
        return t === nid
      })
      if (check(advN.id) || check(contrN.id)) {
        divEdge.transition().duration(600).attr('opacity', 0).remove()
        return
      }
      pulseId = requestAnimationFrame(pulseDivide)
    }
    pulseId = requestAnimationFrame(pulseDivide)
  }

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
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fillStyle = ROLE_CONFIG[n.role]?.color || '#888'
      ctx.globalAlpha = 0.72
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  function handleLiveToggle() {
    if (liveMode) {
      setLiveMode(false)
      setSnapshotTime(new Date())
    } else {
      setLiveMode(true)
      setSnapshotTime(null)
      setRebuildKey(k => k + 1)  // full rebuild with all missed messages
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: WIDTH, height: '100vh',
      background: 'rgba(8,7,6,0.94)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          {!liveMode && snapshotTime && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.38rem', letterSpacing: '.06em', color: 'var(--muted)', opacity: .55 }}>
              Snapshot — {snapshotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={handleLiveToggle} data-hover
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '.45rem', letterSpacing: '.12em', textTransform: 'uppercase',
              background: 'transparent',
              border: `1px solid ${liveMode ? 'rgba(80,200,100,0.4)' : 'var(--border)'}`,
              borderRadius: '2px', padding: '.2rem .5rem', cursor: 'none',
              color: liveMode ? 'var(--green)' : 'var(--muted)',
              display: 'flex', alignItems: 'center', gap: '.3rem', transition: 'all .2s',
            }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: liveMode ? 'var(--green)' : 'var(--muted)', flexShrink: 0 }} />
            {liveMode ? 'Live' : 'Paused'}
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.45rem', color: 'var(--muted)' }}>{messages.length}</span>
        </div>
      </div>

      {/* Graph */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        {!d3Ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.5rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted)' }}>loading graph…</span>
          </div>
        )}
        {messages.length === 0 && d3Ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'var(--font-caveat)', fontSize: '1.4rem', color: 'var(--muted)', fontStyle: 'italic', opacity: .3 }}>No messages yet.</span>
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
                <line x1={0} y1={3} x2={20} y2={3} stroke={e.stroke} strokeWidth={1.2} strokeDasharray={e.dash} />
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.38rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', opacity: .7 }}>{e.label}</span>
            </div>
          ))}
        </div>

        {/* Minimap */}
        <canvas ref={minimapRef} width={80} height={60}
          style={{ position: 'absolute', bottom: 12, right: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, opacity: 0.75 }} />
      </div>

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
