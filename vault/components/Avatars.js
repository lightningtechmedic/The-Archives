'use client'

import { useRef, useEffect, useState } from 'react'

// ── Primitives ────────────────────────────────────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function hash(n) { return ((Math.sin(n * 9301 + 49297) * 233280) % 1 + 1) % 1 }
function lerp(a, b, t) { return a + (b - a) * t }
function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

// ── Canvas Avatar wrapper ─────────────────────────────────────────────────────
function CanvasAvatar({ drawFn, size, state = 'idle' }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const stateRef = useRef(state)
  const stateEnterRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0)

  useEffect(() => {
    stateRef.current = state
    stateEnterRef.current = performance.now()
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const startTime = performance.now()

    function loop(now) {
      const t = (now - startTime) / 1000
      const age = (now - stateEnterRef.current) / 1000
      ctx.clearRect(0, 0, size, size)
      drawFn(ctx, size, size, t, age, stateRef.current)
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [size]) // eslint-disable-line

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', flexShrink: 0 }} />
}

// ════════════════════════════════════════════════════════════════
// THE ARCHITECT
// idle: scan sweeps, iris tracks slowly, grid drifts
// processing: iris speeds, scan races, brackets tighten, glow
// responding: iris slows to center — focused
// disagreeing: brows furrow, iris darts rapidly
// interjecting: scale pulse, brackets flash
// silent: grid fades, scan barely visible
// ════════════════════════════════════════════════════════════════
export function drawArchitect(ctx, w, h, t, age, state = 'idle') {
  const s = w / 88

  // Scale pulse for interjecting
  const pulse = state === 'interjecting'
    ? 1 + 0.05 * Math.abs(Math.sin(age * 12)) * Math.exp(-age * 3)
    : 1

  if (pulse !== 1) {
    const off = (1 - pulse) * w * 0.5
    ctx.save(); ctx.translate(-off, -off); ctx.scale(pulse, pulse)
  }

  // Outer glow for processing
  if (state === 'processing') {
    ctx.shadowBlur = 14 * s
    ctx.shadowColor = 'rgba(212,84,26,0.5)'
  }

  // Body
  ctx.fillStyle = '#080604'
  rrect(ctx, 0, 0, w, h, 8 * s); ctx.fill()
  ctx.shadowBlur = 0

  // Border
  const bA = state === 'interjecting' && age < 0.25 ? 0.9
    : state === 'processing' ? 0.72
    : 0.42
  ctx.strokeStyle = `rgba(212,84,26,${bA})`
  ctx.lineWidth = 1.4 * s
  rrect(ctx, 0.7 * s, 0.7 * s, w - 1.4 * s, h - 1.4 * s, 7.3 * s); ctx.stroke()

  // Blueprint grid (diagonal drift)
  const gSpeed = state === 'silent' ? 2 : state === 'processing' ? 18 : 6
  const gs = 18 * s
  const gOff = (t * gSpeed * 0.013 * w) % gs
  const gA = state === 'silent' ? 0.03 : 0.07
  ctx.strokeStyle = `rgba(212,84,26,${gA})`
  ctx.lineWidth = 0.6 * s
  for (let x = -gs + gOff; x < w + gs; x += gs) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + gs, h); ctx.stroke()
  }
  for (let y = -gs + gOff; y < h + gs; y += gs) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + gs); ctx.stroke()
  }

  // Scan line
  const scanA = state === 'silent' ? 0.04 : state === 'processing' ? 0.24 : 0.11
  const scanDur = state === 'processing' ? 1.35 : 4.0
  const scanY = ((t % scanDur) / scanDur) * h
  const sg = ctx.createLinearGradient(0, 0, w, 0)
  sg.addColorStop(0, 'rgba(212,84,26,0)')
  sg.addColorStop(0.5, `rgba(212,84,26,${scanA})`)
  sg.addColorStop(1, 'rgba(212,84,26,0)')
  ctx.fillStyle = sg; ctx.fillRect(0, scanY - 1.2 * s, w, 2.5 * s)

  // Corner brackets — tighten in processing
  const bp = state === 'processing'
    ? Math.max(1.8 * s, 3.5 * s - Math.min(age * 1.5, 1.5) * s)
    : 3.5 * s
  const bl = 8 * s
  const bkA = state === 'interjecting' && age < 0.15 ? 0.92 : 0.52
  ctx.strokeStyle = `rgba(212,84,26,${bkA})`
  ctx.lineWidth = 1.2 * s; ctx.lineJoin = 'miter'
  ctx.beginPath(); ctx.moveTo(bp, bp + bl); ctx.lineTo(bp, bp); ctx.lineTo(bp + bl, bp); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(w - bp - bl, bp); ctx.lineTo(w - bp, bp); ctx.lineTo(w - bp, bp + bl); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(bp, h - bp - bl); ctx.lineTo(bp, h - bp); ctx.lineTo(bp + bl, h - bp); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(w - bp - bl, h - bp); ctx.lineTo(w - bp, h - bp); ctx.lineTo(w - bp, h - bp - bl); ctx.stroke()

  // Eye sockets
  const eyeW = 24 * s, eyeH = 9 * s
  const e1x = 8 * s, e2x = 56 * s, ey = 38 * s
  ctx.fillStyle = '#000'
  ctx.fillRect(e1x, ey, eyeW, eyeH); ctx.fillRect(e2x, ey, eyeW, eyeH)

  // Iris position
  let iP
  if (state === 'disagreeing')      iP = 0.5 + 0.5 * Math.sin(t * Math.PI * 4.5)
  else if (state === 'responding')  iP = 0.5 + 0.18 * Math.sin(t * Math.PI / 3.5)
  else if (state === 'processing')  iP = Math.sin(t * Math.PI / 0.62) * 0.5 + 0.5
  else if (state === 'silent')      iP = 0.5 + 0.12 * Math.sin(t * Math.PI / 5)
  else                              iP = Math.sin(t * Math.PI / 1.6) * 0.5 + 0.5

  const iRange = eyeW - 9 * s, iW = 8 * s, iH = eyeH - 2 * s
  const i1x = e1x + 1 * s + iP * iRange
  const i2x = e2x + 1 * s + iP * iRange
  const iy = ey + 1 * s

  ctx.fillStyle = state === 'processing' ? '#ff5a22' : '#d4541a'
  ctx.fillRect(i1x, iy, iW, iH); ctx.fillRect(i2x, iy, iW, iH)

  // Pupil bar
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(i1x + iW * 0.28, iy, iW * 0.44, iH)
  ctx.fillRect(i2x + iW * 0.28, iy, iW * 0.44, iH)

  // Highlight
  ctx.fillStyle = 'rgba(255,195,140,0.5)'
  ctx.fillRect(i1x + 0.5 * s, iy + 0.5 * s, 2.5 * s, 1.5 * s)
  ctx.fillRect(i2x + 0.5 * s, iy + 0.5 * s, 2.5 * s, 1.5 * s)

  // Brows
  const bry = ey - 5.5 * s, brH = 2 * s
  ctx.fillStyle = 'rgba(212,84,26,0.6)'
  if (state === 'disagreeing') {
    const f = 0.28
    ctx.save(); ctx.translate(e1x + eyeW / 2, bry + brH / 2); ctx.rotate(f)
    ctx.fillRect(-eyeW / 2, -brH / 2, eyeW, brH); ctx.restore()
    ctx.save(); ctx.translate(e2x + eyeW / 2, bry + brH / 2); ctx.rotate(-f)
    ctx.fillRect(-eyeW / 2, -brH / 2, eyeW, brH); ctx.restore()
  } else {
    ctx.fillRect(e1x, bry, eyeW, brH)
    ctx.fillRect(e2x, bry, eyeW, brH)
  }

  if (pulse !== 1) ctx.restore()
}

export function AvatarArchitect({ size = 30, state = 'idle' }) {
  return <CanvasAvatar drawFn={drawArchitect} size={size} state={state} />
}

// ════════════════════════════════════════════════════════════════
// THE SPARK
// idle: pupils drift lazily, one star fades in/out
// excited: eyes widen, all 3 stars burst, smile deepens
// sending: right eye winks
// glitching: chromatic aberration burst
// reacting: single star pops (one-word moment)
// bored: pupils still, right eye half-closed
// ════════════════════════════════════════════════════════════════
export function drawSpark(ctx, w, h, t, age, state = 'idle') {
  const s = w / 88

  // Body
  ctx.fillStyle = '#0c0a01'
  rrect(ctx, 0, 0, w, h, 12 * s); ctx.fill()

  // Border (pulses gold in excited)
  const bA = state === 'excited' ? 0.68 + 0.28 * Math.sin(t * 5) : 0.45
  ctx.strokeStyle = `rgba(200,151,58,${bA})`
  ctx.lineWidth = 1.4 * s
  rrect(ctx, 0.7 * s, 0.7 * s, w - 1.4 * s, h - 1.4 * s, 11.3 * s); ctx.stroke()

  // Eye scale (excited widens them briefly)
  const excScale = state === 'excited' && age < 0.4
    ? 1 + 0.14 * Math.sin((age / 0.4) * Math.PI)
    : 1

  // Deterministic pupil dart
  const isBored = state === 'bored'
  const di = 1.5
  const dp = isBored ? 0 : Math.floor(t / di)
  const dLerp = isBored ? 0 : ease(Math.min((t % di) / 0.22, 1))
  const h7 = (n, o = 0) => hash(n * 7 + o) * 2 - 1
  const lpx = lerp(h7(dp - 1, 1), h7(dp, 1), dLerp) * 5 * s
  const lpy = lerp(h7(dp - 1, 2), h7(dp, 2), dLerp) * 3 * s
  const rpx = lerp(h7(dp - 1, 3), h7(dp, 3), dLerp) * 3.5 * s
  const rpy = lerp(h7(dp - 1, 4), h7(dp, 4), dLerp) * 2.5 * s

  // Blink cycles (independent)
  const lbc = 8.0, rbc = 12.0
  const lbp = (t % lbc) / lbc, rbp = (t % rbc) / rbc
  const lBl = lbp > 0.88 ? Math.sin(((lbp - 0.88) / 0.12) * Math.PI) : 0
  let rBl = rbp > 0.92 ? Math.sin(((rbp - 0.92) / 0.08) * Math.PI) : 0
  // sending: right eye winks
  if (state === 'sending' && age < 0.45) rBl = Math.sin((age / 0.45) * Math.PI)
  // bored: right eye half-closed
  const boredLid = isBored ? 0.5 + 0.08 * Math.sin(t * 0.45) : 0

  // LEFT EYE — cx=25, cy=30, r=13 at 88px
  const lx = 25 * s, ly = 30 * s, lr = 13 * s * excScale
  ctx.save()
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
  ctx.fillStyle = '#c8973a'; ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2)
  ctx.fillStyle = '#1a0d00'
  ctx.beginPath(); ctx.arc(lx + lpx, ly + lpy, lr * 0.38, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.beginPath(); ctx.arc(lx + lpx - lr * 0.12, ly + lpy - lr * 0.15, lr * 0.14, 0, Math.PI * 2); ctx.fill()
  if (lBl > 0) { ctx.fillStyle = '#0c0a01'; ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2 * lBl) }
  ctx.restore()
  ctx.strokeStyle = 'rgba(200,151,58,0.38)'; ctx.lineWidth = 0.8 * s
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.stroke()

  // RIGHT EYE — cx=53, cy=37, r=9 at 88px
  const rx = 53 * s, ry = 37 * s, rr2 = 9 * s * excScale
  ctx.save()
  ctx.beginPath(); ctx.arc(rx, ry, rr2, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
  ctx.fillStyle = '#b0882a'; ctx.fillRect(rx - rr2, ry - rr2, rr2 * 2, rr2 * 2)
  ctx.fillStyle = '#1a0d00'
  ctx.beginPath(); ctx.arc(rx + rpx, ry + rpy, rr2 * 0.38, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.66)'
  ctx.beginPath(); ctx.arc(rx + rpx - rr2 * 0.12, ry + rpy - rr2 * 0.15, rr2 * 0.16, 0, Math.PI * 2); ctx.fill()
  const effRBl = Math.max(rBl, boredLid)
  if (effRBl > 0) { ctx.fillStyle = '#0c0a01'; ctx.fillRect(rx - rr2, ry - rr2, rr2 * 2, rr2 * 2 * effRBl) }
  ctx.restore()
  ctx.strokeStyle = 'rgba(200,151,58,0.32)'; ctx.lineWidth = 0.8 * s
  ctx.beginPath(); ctx.arc(rx, ry, rr2, 0, Math.PI * 2); ctx.stroke()

  // Stars — 3 positions
  const burstAll = state === 'excited' && age < 0.65
  const singlePop = state === 'reacting' && age < 1.0
  const slowIdle = state === 'idle' || state === 'bored'
  const starSpeed = burstAll ? 3.5 : slowIdle ? 0.55 : 1.2
  const starPts = [{ x: 70 * s, y: 16 * s, ph: 0 }, { x: 78 * s, y: 44 * s, ph: 0.33 }, { x: 62 * s, y: 60 * s, ph: 0.66 }]

  for (let i = 0; i < starPts.length; i++) {
    const st = starPts[i]
    let alpha, yOff
    if (burstAll) {
      alpha = Math.sin((age / 0.65) * Math.PI)
      yOff = -11 * s * (age / 0.65)
    } else if (singlePop && i === 0) {
      alpha = Math.sin((age / 1.0) * Math.PI)
      yOff = -8 * s * (age / 1.0)
    } else if (state === 'bored') {
      // One star half-closed (only star 0 barely visible)
      alpha = i === 0 ? 0.25 * (Math.sin(t * 0.35) * 0.5 + 0.5) : 0
      yOff = 0
    } else {
      // Idle: only star 0 pulses gently
      const ph = ((t * starSpeed + st.ph) % 1)
      alpha = i === 0 ? Math.sin(ph * Math.PI) * 0.8 : Math.sin(ph * Math.PI) * (state === 'excited' ? 0.9 : 0)
      yOff = -8 * s * ph
    }
    if (alpha > 0.04) {
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#c8973a'
      ctx.font = `${10 * s}px serif`
      ctx.fillText('✦', st.x - 5 * s, st.y + yOff)
    }
  }
  ctx.globalAlpha = 1

  // Smile
  const smD = state === 'excited' ? 12 * s : state === 'bored' ? 3 * s : 6 * s
  ctx.strokeStyle = `rgba(200,151,58,${state === 'bored' ? 0.35 : 0.6})`
  ctx.lineWidth = 1.8 * s
  ctx.beginPath(); ctx.moveTo(22 * s, 64 * s)
  ctx.quadraticCurveTo(44 * s, 64 * s + smD, 66 * s, 64 * s); ctx.stroke()

  // Chromatic aberration (glitching)
  if (state === 'glitching' && age < 0.5) {
    const gA = Math.sin((age / 0.5) * Math.PI) * 0.38
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = gA
    ctx.translate(-3 * s, 0)
    ctx.fillStyle = 'rgba(255,0,60,1)'
    rrect(ctx, 0, 0, w, h, 12 * s); ctx.fill()
    ctx.translate(6 * s, 0)
    ctx.fillStyle = 'rgba(0,80,255,1)'
    rrect(ctx, 0, 0, w, h, 12 * s); ctx.fill()
    ctx.restore()
  }
}

export function AvatarSpark({ size = 30, state = 'idle' }) {
  return <CanvasAvatar drawFn={drawSpark} size={size} state={state} />
}

// ════════════════════════════════════════════════════════════════
// SOCRA
// idle: nods (5.5s), beard sways, blinks independently
// panelopen: pupils shift up briefly then settle
// reading: eyes scan left-right (slow, considered)
// delivering: scroll glows bright, one deliberate blink-nod
// silent: head tilts, one brow raises
// ════════════════════════════════════════════════════════════════
export function drawSocra(ctx, w, h, t, age, state = 'idle') {
  const s = w / 88
  const cx = w / 2

  // Background
  ctx.fillStyle = '#060705'
  rrect(ctx, 0, 0, w, h, 8 * s); ctx.fill()
  ctx.strokeStyle = 'rgba(80,200,100,0.3)'
  ctx.lineWidth = 1.2 * s
  rrect(ctx, 0.6 * s, 0.6 * s, w - 1.2 * s, h - 1.2 * s, 7.4 * s); ctx.stroke()

  // Nod transform
  const nodAmp = state === 'delivering' ? 0.065 : 0.032
  const nodTilt = state === 'silent' ? 0.055 : 0
  const nodAngle = nodAmp * Math.sin(t * Math.PI * 2 / 5.5) + nodTilt
  ctx.save()
  ctx.translate(cx, h * 0.92); ctx.rotate(nodAngle); ctx.translate(-cx, -h * 0.92)

  // Robe/body
  ctx.fillStyle = '#2a3028'
  ctx.beginPath()
  ctx.moveTo(cx - 14 * s, 36 * s); ctx.lineTo(cx + 14 * s, 36 * s)
  ctx.lineTo(cx + 24 * s, 84 * s); ctx.lineTo(cx - 24 * s, 84 * s)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(80,200,100,0.09)'; ctx.lineWidth = 0.8 * s
  ctx.beginPath(); ctx.moveTo(cx, 36 * s); ctx.lineTo(cx - 6 * s, 84 * s); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, 36 * s); ctx.lineTo(cx + 6 * s, 84 * s); ctx.stroke()

  // Head
  ctx.fillStyle = '#c8a87a'
  ctx.beginPath(); ctx.arc(cx, 22 * s, 13 * s, 0, Math.PI * 2); ctx.fill()

  // Eyes
  const eyeLX = cx - 5 * s, eyeRX = cx + 5 * s, eyeY = 21 * s, eyeR = 2.8 * s

  // Pupil drift / scan
  let dX, dY
  if (state === 'reading') {
    dX = Math.sin(t * Math.PI * 2 / 2.8) * eyeR * 0.55; dY = 0
  } else if (state === 'panelopen') {
    dX = 0; dY = age < 0.5 ? -eyeR * 0.4 * (1 - age / 0.5) : 0
  } else {
    dX = Math.sin(t * 0.7) * 0.75 * s; dY = Math.sin(t * 0.48) * 0.4 * s
  }

  // Blink (independent cycles)
  const lBc = 7.0, rBc = 11.0
  const lBp = ((t + 1.3) % lBc) / lBc, rBp = (t % rBc) / rBc
  const lBlA = lBp > 0.87 ? Math.sin(((lBp - 0.87) / 0.13) * Math.PI) : 0
  const rBlA = rBp > 0.91 ? Math.sin(((rBp - 0.09) / 0.09) * Math.PI) : 0
  // delivering: one deliberate blink-nod
  const deliverBl = state === 'delivering' && age < 0.9
    ? Math.sin((age / 0.9) * Math.PI)
    : 0

  // Brow raise for silent
  const browRaise = state === 'silent' ? 1.5 * s : 0

  const eyes = [[eyeLX, Math.max(lBlA, deliverBl > 0 ? deliverBl : 0), browRaise], [eyeRX, rBlA, 0]]
  for (const [ex, eBl, bRaise] of eyes) {
    ctx.save()
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeR, eyeR * 0.85, 0, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
    ctx.fillStyle = '#f0e0c0'; ctx.fillRect(ex - eyeR, eyeY - eyeR, eyeR * 2, eyeR * 2)
    ctx.fillStyle = '#5a7a4a'
    ctx.beginPath(); ctx.arc(ex + dX * 0.5, eyeY + dY * 0.5, eyeR * 0.65, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1a0a'
    ctx.beginPath(); ctx.arc(ex + dX, eyeY + dY, eyeR * 0.3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath(); ctx.arc(ex + dX - eyeR * 0.12, eyeY + dY - eyeR * 0.15, eyeR * 0.14, 0, Math.PI * 2); ctx.fill()
    if (eBl > 0.02) { ctx.fillStyle = '#c8a87a'; ctx.fillRect(ex - eyeR, eyeY - eyeR, eyeR * 2, eyeR * 2 * eBl) }
    ctx.restore()
    ctx.strokeStyle = 'rgba(80,60,20,0.45)'; ctx.lineWidth = 0.5 * s
    ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeR, eyeR * 0.85, 0, 0, Math.PI * 2); ctx.stroke()
    // Brow (raised for silent state, left eye only)
    if (bRaise > 0) {
      ctx.strokeStyle = 'rgba(100,80,40,0.7)'; ctx.lineWidth = 1.1 * s
      ctx.beginPath()
      ctx.moveTo(ex - eyeR * 0.8, eyeY - eyeR * 1.35 - bRaise)
      ctx.lineTo(ex + eyeR * 0.8, eyeY - eyeR * 1.35 - bRaise * 0.3)
      ctx.stroke()
    }
  }

  // Beard sway
  const bS = Math.sin(t * Math.PI * 2 / 3.2) * 0.055
  ctx.save()
  ctx.translate(cx, 30 * s); ctx.transform(1, 0, bS, 1, 0, 0); ctx.translate(-cx, -30 * s)
  ctx.fillStyle = '#e8e0d0'
  ctx.beginPath()
  ctx.moveTo(cx - 8 * s, 30 * s)
  ctx.quadraticCurveTo(cx - 11 * s, 40 * s, cx - 7 * s, 48 * s)
  ctx.quadraticCurveTo(cx - 4 * s, 54 * s, cx, 56 * s)
  ctx.quadraticCurveTo(cx + 4 * s, 54 * s, cx + 7 * s, 48 * s)
  ctx.quadraticCurveTo(cx + 11 * s, 40 * s, cx + 8 * s, 30 * s)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(180,170,155,0.5)'; ctx.lineWidth = 0.6 * s
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 2.5 * s, 32 * s)
    ctx.quadraticCurveTo(cx + i * 3 * s + bS * 20 * s, 44 * s, cx + i * 2 * s, 54 * s)
    ctx.stroke()
  }
  ctx.restore()

  // Arms
  ctx.strokeStyle = '#2a3028'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(cx - 14 * s, 44 * s); ctx.quadraticCurveTo(cx - 22 * s, 58 * s, cx - 18 * s, 68 * s); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + 14 * s, 44 * s); ctx.quadraticCurveTo(cx + 20 * s, 58 * s, cx + 16 * s, 66 * s); ctx.stroke()

  // Scroll (left hand, glows)
  const sGlow = state === 'delivering'
    ? 0.45 + 0.35 * Math.sin(age * Math.PI * 2.2)
    : 0.22 + 0.18 * Math.sin(t * Math.PI * 2)
  ctx.shadowBlur = 8 * s; ctx.shadowColor = `rgba(80,200,100,${sGlow})`
  ctx.fillStyle = '#d4c890'
  rrect(ctx, cx - 28 * s, 62 * s, 14 * s, 18 * s, 2 * s); ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = `rgba(80,200,100,${sGlow * 0.85})`; ctx.lineWidth = 0.8 * s
  rrect(ctx, cx - 28 * s, 62 * s, 14 * s, 18 * s, 2 * s); ctx.stroke()
  ctx.strokeStyle = 'rgba(100,80,30,0.4)'; ctx.lineWidth = 0.6 * s
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx - 26 * s, 65 * s + i * 3.5 * s); ctx.lineTo(cx - 16 * s, 65 * s + i * 3.5 * s); ctx.stroke()
  }

  ctx.restore() // end nod transform
}

const WISDOM = [
  'The unexamined idea ships anyway.',
  'Know what you don\'t know before you build.',
  'Clarity is the rarest luxury.',
  'Begin with what is true, not what is useful.',
  'Every great product was once a bad idea, held long enough.',
  'The draft that ships is the one that mattered.',
  'A question asked well is half answered.',
  'What are we actually trying to say?',
]

export function AvatarSocra({ size = 88, state = 'idle', onScrollClick, showThought = true }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const stateRef = useRef(state)
  const stateEnterRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0)
  const [thought, setThought] = useState(null)
  const [wisdomIdx, setWisdomIdx] = useState(0)

  useEffect(() => {
    stateRef.current = state
    stateEnterRef.current = performance.now()
  }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const start = performance.now()
    function loop(now) {
      const t = (now - start) / 1000
      const age = (now - stateEnterRef.current) / 1000
      ctx.clearRect(0, 0, size, size)
      drawSocra(ctx, size, size, t, age, stateRef.current)
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [size])

  // Thought bubble on idle every 9s (only medium+ size)
  useEffect(() => {
    if (!showThought || size < 44) return
    const timer = setInterval(() => {
      setThought(WISDOM[Math.floor(Math.random() * WISDOM.length)])
      setTimeout(() => setThought(null), 4500)
    }, 9000)
    return () => clearInterval(timer)
  }, [size, showThought])

  function handleClick() {
    const next = (wisdomIdx + 1) % WISDOM.length
    setWisdomIdx(next)
    onScrollClick?.(WISDOM[next])
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }} onClick={handleClick}>
      <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', cursor: 'pointer' }} />
      {thought && (
        <div style={{
          position: 'absolute', bottom: size + 4, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(6,7,5,0.94)', border: '1px solid rgba(80,200,100,0.3)',
          borderRadius: '6px', padding: '.4rem .65rem', pointerEvents: 'none',
          minWidth: 140, maxWidth: 200, zIndex: 200, animation: 'fadeIn .35s ease forwards',
        }}>
          <p style={{ fontFamily: 'var(--font-caveat)', fontSize: '.85rem', color: 'rgba(80,200,100,0.85)', lineHeight: 1.35, textAlign: 'center', margin: 0 }}>
            {thought}
          </p>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// YOU — hex lightning canvas
// idle: completely still
// sending: bolt charges (0.3s) → fires white-hot (0.5s) → settles
// replied: single quiet hex outline pulse
// pinning: bolt dims → re-ignites
// silent: very slow subtle breathing pulse
// ════════════════════════════════════════════════════════════════
export function drawYou(ctx, w, h, t, age, state = 'idle') {
  const s = w / 88
  const cx = w / 2, cy = h / 2
  const hr = w * 0.47
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * Math.PI / 180
    return [cx + hr * Math.cos(a), cy + hr * Math.sin(a)]
  })
  const hexPath = () => {
    ctx.beginPath()
    hex.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
    ctx.closePath()
  }

  // Background
  ctx.fillStyle = '#1a0d05'; hexPath(); ctx.fill()

  // Hex border
  const hexBA = state === 'silent' ? 0.28 + 0.15 * Math.sin(t * 0.45) : 0.5
  ctx.strokeStyle = `rgba(212,84,26,${hexBA})`; ctx.lineWidth = 1.4 * s; hexPath(); ctx.stroke()

  // Arc segments — only during 'sending' or 'silent' states
  if (state === 'sending' || state === 'silent') {
    const arcA = state === 'sending'
      ? (age < 0.3 ? (age / 0.3) * 0.38 : age < 0.8 ? 0.42 : Math.max(0, 0.42 - (age - 0.8) / 0.4))
      : 0.06 * (Math.sin(t * 0.4) * 0.5 + 0.5)
    const arcSpd = state === 'sending' && age >= 0.3 && age < 0.8 ? 10 : 1.5
    for (let i = 0; i < 3; i++) {
      const rot = state === 'idle' ? 0 : t * arcSpd * (i % 2 === 0 ? 1 : -1)
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy)
      ctx.strokeStyle = `rgba(212,84,26,${arcA})`; ctx.lineWidth = 1.2 * s
      ctx.setLineDash([(15 + i * 8) * s, 80 * s])
      ctx.beginPath(); ctx.arc(cx, cy, (12 + i * 7) * s, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
  }

  // Lightning bolt — clipped to hex
  ctx.save(); hexPath(); ctx.clip()

  // Bolt color/alpha by state
  let boltAlpha = 1
  const gTop = [255, 128, 64], gBot = [26, 10, 4]

  if (state === 'sending') {
    if (age < 0.3) {
      // Charge up
      const c = age / 0.3
      gTop[1] = Math.round(128 + c * 127); gTop[2] = Math.round(64 + c * 191)
      gBot[0] = Math.round(26 + c * 80)
    } else if (age < 0.8) {
      // Fire — white hot
      gTop[0] = 255; gTop[1] = 255; gTop[2] = 255
      gBot[0] = 255; gBot[1] = 220; gBot[2] = 120
    } else {
      // Settle back
      const settle = 1 - Math.min((age - 0.8) / 0.6, 1)
      gTop[1] = Math.round(128 + settle * 127); gTop[2] = Math.round(64 + settle * 128)
    }
  } else if (state === 'pinning') {
    boltAlpha = age < 0.2 ? 1 - (age / 0.2) * 0.72 : Math.min(1, 0.28 + (age - 0.2) / 0.35)
  } else if (state === 'silent') {
    boltAlpha = 0.68 + 0.18 * Math.sin(t * 0.5)
  }
  // idle / replied: static bolt

  const grd = ctx.createLinearGradient(cx, cy - hr * 0.72, cx, cy + hr * 0.72)
  grd.addColorStop(0, `rgba(${gTop.join(',')},${boltAlpha})`)
  grd.addColorStop(1, `rgba(${gBot.join(',')},${boltAlpha})`)
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.moveTo(50 * s, 12 * s); ctx.lineTo(36 * s, 46 * s); ctx.lineTo(46 * s, 46 * s)
  ctx.lineTo(38 * s, 76 * s); ctx.lineTo(58 * s, 38 * s); ctx.lineTo(46 * s, 38 * s)
  ctx.closePath(); ctx.fill()
  ctx.restore() // end hex clip

  // 'replied': single hex outline pulse
  if (state === 'replied' && age < 0.8) {
    const pA = Math.sin((age / 0.8) * Math.PI) * 0.75
    ctx.strokeStyle = `rgba(212,84,26,${pA})`; ctx.lineWidth = 2.5 * s
    hexPath(); ctx.stroke()
  }

  // 'sending' fire phase: corner sparks
  if (state === 'sending' && age > 0.3 && age < 0.8) {
    const sAge = age - 0.3
    const sA = sAge < 0.1 ? sAge / 0.1 : Math.max(0, 1 - (sAge - 0.1) / 0.4)
    hex.forEach(([x, y]) => {
      ctx.fillStyle = `rgba(255,180,80,${sA * 0.9})`
      ctx.beginPath(); ctx.arc(x, y, 3 * s * sA, 0, Math.PI * 2); ctx.fill()
    })
  }
}

export function AvatarYou({ size = 30, state = 'idle' }) {
  return <CanvasAvatar drawFn={drawYou} size={size} state={state} />
}

// ════════════════════════════════════════════════════════════════
// SMARA — CSS orb (enhanced with state-based particle control)
// idle: 1 particle, slow, calm
// typing: 2 particles, faster
// sending: 3 particles fast + flare bloom
// pinned: particles spiral inward then out
// mentioned: single warm pulse
// quiet: 1 particle near-stopped, orb dimmed
// collaborating: 3 particles + slow "moon" + collab ring
// ════════════════════════════════════════════════════════════════
export function AvatarSmara({ size = 30, state = 'idle', isCollaborator = false }) {
  const cfg = {
    idle:          { count: 1, speed: 2.4, alpha: 0.9,  flare: false },
    typing:        { count: 2, speed: 1.1, alpha: 1.0,  flare: false },
    sending:       { count: 3, speed: 0.55, alpha: 1.0, flare: true  },
    pinned:        { count: 2, speed: 0.9, alpha: 1.0,  flare: false },
    mentioned:     { count: 2, speed: 1.8, alpha: 1.0,  flare: false },
    quiet:         { count: 1, speed: 5.5, alpha: 0.52, flare: false },
    collaborating: { count: 3, speed: 1.0, alpha: 1.0,  flare: false },
  }[state] || { count: 1, speed: 2.4, alpha: 0.9, flare: false }

  const hasMoon = state === 'collaborating'
  const totalParticles = cfg.count + (hasMoon ? 1 : 0)

  return (
    <div style={{
      width: size, height: size, flexShrink: 0, position: 'relative',
      filter: cfg.flare
        ? `brightness(1.72) drop-shadow(0 0 ${size * 0.14}px rgba(58,212,200,0.88))`
        : state === 'mentioned' ? `drop-shadow(0 0 ${size * 0.1}px rgba(58,212,200,0.6))` : 'none',
      transition: 'filter .45s',
    }}>
      {/* Collab ring */}
      {(isCollaborator || state === 'collaborating') && (
        <div style={{
          position: 'absolute', inset: -2, borderRadius: '50%',
          border: '1.5px solid rgba(58,212,200,0.55)',
          animation: 'breatheOrb 1.8s ease-in-out infinite',
          pointerEvents: 'none', zIndex: 2,
        }} />
      )}
      {/* Orbit particles */}
      {Array.from({ length: totalParticles }).map((_, i) => {
        const isMoon = hasMoon && i === cfg.count
        const orbitR = isMoon ? size * 0.66 : size * (0.36 + i * 0.1)
        const dur = isMoon ? cfg.speed * 2.3 : cfg.speed * (1 + i * 0.3)
        const delay = -(i * dur / Math.max(cfg.count, 1))
        return (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 0, height: 0,
            animation: `rotateCW ${dur}s linear infinite`,
            animationDelay: `${delay}s`,
          }}>
            <div style={{
              position: 'absolute',
              top: -(orbitR + size * 0.045),
              left: -size * 0.045,
              width: size * (isMoon ? 0.11 : 0.09),
              height: size * (isMoon ? 0.11 : 0.09),
              borderRadius: '50%',
              background: isMoon ? 'rgba(58,212,200,0.42)' : `rgba(58,212,200,${0.68 - i * 0.08})`,
              boxShadow: `0 0 ${size * 0.055}px rgba(58,212,200,0.38)`,
            }} />
          </div>
        )
      })}
      {/* Orb core */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,${0.86 * cfg.alpha}), rgba(58,212,200,${0.66 * cfg.alpha}), rgba(30,80,200,${0.36 * cfg.alpha}))`,
        border: '1px solid rgba(58,212,200,0.3)',
        animation: 'breatheOrb 2s ease-in-out infinite',
        opacity: cfg.alpha, transition: 'opacity .6s',
      }} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// THE SCRIBE
// idle: ink drop pulses slowly on nib tip
// thinking: drop swells, quill tilts 4deg
// writing: three ink strokes left of nib + rhythmic drop
// done: downstroke bloom then idle
// ════════════════════════════════════════════════════════════════
export function drawScribe(ctx, w, h, t, age, state = 'idle') {
  const s = w / 88
  const cx = w / 2, cy = h / 2

  ctx.fillStyle = '#0a0c14'
  rrect(ctx, 0, 0, w, h, 8 * s); ctx.fill()

  ctx.strokeStyle = 'rgba(100,140,255,0.04)'
  ctx.lineWidth = 0.5 * s
  const gs = 14 * s
  for (let x = 0; x <= w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y <= h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

  const bPulse = state === 'writing' ? 0.12 * Math.sin(t * 4) : 0
  ctx.strokeStyle = `rgba(100,140,255,${0.28 + bPulse})`
  ctx.lineWidth = 1.2 * s
  rrect(ctx, 0.6 * s, 0.6 * s, w - 1.2 * s, h - 1.2 * s, 7.4 * s); ctx.stroke()

  const cm = 4 * s, cl = 8 * s
  ctx.strokeStyle = 'rgba(100,140,255,0.25)'
  ctx.lineWidth = 1 * s; ctx.lineJoin = 'miter'
  ctx.beginPath(); ctx.moveTo(cm, cm + cl); ctx.lineTo(cm, cm); ctx.lineTo(cm + cl, cm); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(w - cm - cl, cm); ctx.lineTo(w - cm, cm); ctx.lineTo(w - cm, cm + cl); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cm, h - cm - cl); ctx.lineTo(cm, h - cm); ctx.lineTo(cm + cl, h - cm); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(w - cm - cl, h - cm); ctx.lineTo(w - cm, h - cm); ctx.lineTo(w - cm, h - cm - cl); ctx.stroke()

  const tilt = state === 'thinking' ? (Math.PI / 180) * 4 * Math.sin(age * 1.8) : 0
  const nibNeckY = cy - 13 * s
  const nibTipY  = cy + 8 * s
  const nibHW    = 9 * s
  const nibMidY  = (nibNeckY + nibTipY) / 2

  ctx.save()
  ctx.translate(cx, nibMidY); ctx.rotate(tilt); ctx.translate(-cx, -nibMidY)

  ctx.beginPath()
  ctx.moveTo(cx - nibHW, nibNeckY)
  ctx.bezierCurveTo(cx - nibHW * 1.18, nibNeckY + 14 * s, cx - nibHW * 0.25, nibTipY - 3 * s, cx, nibTipY)
  ctx.lineTo(cx - nibHW * 0.45, nibNeckY + 11 * s)
  ctx.bezierCurveTo(cx - nibHW * 0.75, nibNeckY + 5 * s, cx - nibHW, nibNeckY + 2 * s, cx - nibHW, nibNeckY)
  ctx.closePath()
  ctx.fillStyle = 'rgba(240,236,228,0.88)'; ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx + nibHW, nibNeckY)
  ctx.bezierCurveTo(cx + nibHW * 1.18, nibNeckY + 14 * s, cx + nibHW * 0.25, nibTipY - 3 * s, cx, nibTipY)
  ctx.lineTo(cx + nibHW * 0.45, nibNeckY + 11 * s)
  ctx.bezierCurveTo(cx + nibHW * 0.75, nibNeckY + 5 * s, cx + nibHW, nibNeckY + 2 * s, cx + nibHW, nibNeckY)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath(); ctx.moveTo(cx - nibHW, nibNeckY); ctx.lineTo(cx + nibHW, nibNeckY)
  ctx.strokeStyle = 'rgba(200,195,185,0.55)'; ctx.lineWidth = 1.2 * s; ctx.stroke()

  ctx.beginPath(); ctx.moveTo(cx, nibNeckY + 3 * s); ctx.lineTo(cx, nibTipY)
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 0.7 * s; ctx.stroke()

  ctx.restore()

  const dropTipY = nibTipY + 5 * s
  let dropS, dropA
  if (state === 'idle') {
    dropS = 1 + 0.38 * Math.abs(Math.sin(t * Math.PI / 2.8)); dropA = 0.9
  } else if (state === 'thinking') {
    dropS = 1 + Math.min(age, 1) * 0.8; dropA = 0.85
  } else if (state === 'writing') {
    const cycle = t % 1.2
    dropS = 1 + 0.28 * Math.abs(Math.sin(cycle * Math.PI / 1.2)); dropA = 0.9
  } else if (state === 'done') {
    dropS = age < 0.2 ? 1.5 : Math.max(0, 1.5 - (age - 0.2) * 2.5)
    dropA = Math.max(0, 1 - age / 0.6)
  } else {
    dropS = 1; dropA = 0.9
  }

  if (dropA > 0.01) {
    const dr = 4 * s * dropS
    ctx.save()
    ctx.translate(cx, dropTipY); ctx.scale(1, 1.45)
    ctx.globalAlpha = dropA
    ctx.beginPath(); ctx.arc(0, 0, dr, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(100,140,255,0.92)'
    ctx.shadowBlur = 10 * s; ctx.shadowColor = 'rgba(100,140,255,0.55)'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.restore()
    ctx.globalAlpha = 1
  }

  if (state === 'writing') {
    const baseX = cx - 26 * s, baseY = nibNeckY + 4 * s
    for (let i = 0; i < 3; i++) {
      const phase = ((t - i * 0.3) % 1.1 + 1.1) % 1.1
      const a = phase < 0.4 ? phase / 0.4 : phase < 0.8 ? 1 - (phase - 0.4) / 0.4 : 0
      if (a > 0) {
        ctx.globalAlpha = a * 0.62
        ctx.fillStyle = 'rgba(100,140,255,1)'
        ctx.fillRect(baseX, baseY + i * 5 * s, 12 * s, 1.5 * s)
      }
    }
    ctx.globalAlpha = 1
  }

  if (state === 'done' && age < 0.7) {
    const dA = Math.max(0, 1 - age / 0.7)
    const lineLen = 14 * s * Math.min(age / 0.2, 1)
    ctx.save()
    ctx.globalAlpha = dA
    ctx.strokeStyle = 'rgba(100,140,255,1)'
    ctx.lineWidth = 2 * s; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(cx, nibTipY); ctx.lineTo(cx, nibTipY + lineLen); ctx.stroke()
    if (age > 0.18) {
      const bA = age - 0.18
      const bLen = 6 * s * Math.min(bA / 0.28, 1)
      const bBase = nibTipY + lineLen
      ctx.lineWidth = 1.2 * s; ctx.globalAlpha = dA * 0.65
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, bBase)
        ctx.lineTo(cx + Math.cos(ang) * bLen, bBase + Math.sin(ang) * bLen)
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}

export function AvatarScribe({ size = 30, state = 'idle' }) {
  return <CanvasAvatar drawFn={drawScribe} size={size} state={state} />
}

// ════════════════════════════════════════════════════════════════
// THE STEWARD — budget, roadmap, project health, long view
// idle: wax seal pulses slowly 0.7→0.4→0.7 every 3.2s — patient, watching
// thinking: right page lifts on a slow turn; new timeline dot appears
// done: seal brightens to 1.0, stamp motion (scale 1.2→0.9→1.0)
// concern: last timeline dot turns amber, seal dims
// rejected: seal fades to muted grey; pages fan briefly then close
// ════════════════════════════════════════════════════════════════
export function drawSteward(ctx, w, h, t, age, state = 'idle') {
  const s = w / 88

  // ── Background
  ctx.fillStyle = '#120f0c'
  rrect(ctx, 0, 0, w, h, 8 * s); ctx.fill()

  // ── Grid (barely visible)
  ctx.strokeStyle = 'rgba(180,150,100,0.025)'
  ctx.lineWidth = 0.5 * s
  const gs = 14 * s
  for (let x = 0; x <= w; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = 0; y <= h; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

  // ── Border
  ctx.strokeStyle = 'rgba(180,150,100,0.22)'
  ctx.lineWidth = 1.1 * s
  rrect(ctx, 0.55 * s, 0.55 * s, w - 1.1 * s, h - 1.1 * s, 7.45 * s); ctx.stroke()

  // ── State-derived animation values
  let sealOpacity = 0.7
  let sealScale = 1
  let pageTurnAngle = 0
  let fanAngle = 0
  let sealR = 212, sealG = 84, sealB = 26

  if (state === 'idle') {
    sealOpacity = 0.4 + 0.3 * (Math.sin(t * Math.PI * 2 / 3.2) * 0.5 + 0.5)
  } else if (state === 'thinking') {
    sealOpacity = 0.25 + 0.08 * Math.abs(Math.sin(t * 1.5))
    const cycle = age % 1.0
    pageTurnAngle = cycle < 0.6
      ? Math.sin((cycle / 0.6) * Math.PI) * (6 * Math.PI / 180)
      : 0
  } else if (state === 'done') {
    sealOpacity = age < 0.5 ? Math.min(1.0, 0.7 + (age / 0.5) * 0.3) : 0.85
    if (age < 0.15)       sealScale = lerp(1, 1.2, age / 0.15)
    else if (age < 0.3)   sealScale = lerp(1.2, 0.9, (age - 0.15) / 0.15)
    else if (age < 0.5)   sealScale = lerp(0.9, 1.0, (age - 0.3) / 0.2)
  } else if (state === 'concern') {
    sealOpacity = 0.35 + 0.12 * Math.abs(Math.sin(t * 2.5))
  } else if (state === 'rejected') {
    sealR = 100; sealG = 90; sealB = 80; sealOpacity = 0.55
    fanAngle = age < 0.55
      ? Math.sin((age / 0.55) * Math.PI * 2.5) * (3.5 * Math.PI / 180)
      : 0
  }

  // ── Ledger book
  const lCx = 44 * s, lCy = 47 * s
  const lW = 32 * s, lH = 26 * s
  const lAngle = (4 * Math.PI) / 180

  ctx.save()
  ctx.translate(lCx, lCy); ctx.rotate(lAngle + fanAngle); ctx.translate(-lCx, -lCy)

  // Cover
  ctx.fillStyle = '#1e1a14'
  rrect(ctx, lCx - lW / 2, lCy - lH / 2, lW, lH, 2 * s); ctx.fill()
  ctx.strokeStyle = 'rgba(160,130,80,0.14)'
  ctx.lineWidth = 0.6 * s
  rrect(ctx, lCx - lW / 2, lCy - lH / 2, lW, lH, 2 * s); ctx.stroke()

  // Corner wear
  const cg = 4 * s
  ctx.strokeStyle = 'rgba(180,150,100,0.3)'; ctx.lineWidth = 0.85 * s
  const corners = [
    [lCx - lW / 2, lCy - lH / 2, 1, 1],
    [lCx + lW / 2, lCy - lH / 2, -1, 1],
    [lCx - lW / 2, lCy + lH / 2, 1, -1],
    [lCx + lW / 2, lCy + lH / 2, -1, -1],
  ]
  for (const [cx2, cy2, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx2 + dx * cg, cy2); ctx.lineTo(cx2, cy2); ctx.lineTo(cx2, cy2 + dy * cg)
    ctx.stroke()
  }

  // LEFT PAGE
  ctx.save()
  ctx.beginPath()
  ctx.rect(lCx - lW / 2 + 1.5 * s, lCy - lH / 2 + 1.5 * s, lW / 2 - 2.5 * s, lH - 3 * s)
  ctx.clip()
  ctx.fillStyle = '#e8dfc8'
  ctx.fillRect(lCx - lW / 2 + 1.5 * s, lCy - lH / 2 + 1.5 * s, lW / 2 - 2.5 * s, lH - 3 * s)

  // Timeline
  const tlY = lCy - 3.5 * s
  const tlX1 = lCx - lW / 2 + 4 * s
  const tlX2 = lCx - 3 * s
  ctx.strokeStyle = 'rgba(180,150,100,0.25)'; ctx.lineWidth = 0.6 * s
  ctx.beginPath(); ctx.moveTo(tlX1, tlY); ctx.lineTo(tlX2, tlY); ctx.stroke()

  const dotSpacing = (tlX2 - tlX1) / 3
  for (let i = 0; i < 4; i++) {
    const dx = tlX1 + i * dotSpacing
    let dotColor = 'rgba(180,150,100,0.6)'
    if (state === 'concern' && i === 3) dotColor = 'rgba(200,151,58,0.85)'
    let dotAlpha = 1
    if (state === 'thinking' && i === 3) {
      dotAlpha = Math.min(Math.max((age - 0.4) / 0.6, 0), 1)
    }
    if (dotAlpha > 0.02) {
      ctx.globalAlpha = dotAlpha
      ctx.fillStyle = dotColor
      ctx.beginPath(); ctx.arc(dx, tlY, 1.8 * s, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  // Faint page lines below timeline
  ctx.strokeStyle = 'rgba(140,110,70,0.18)'; ctx.lineWidth = 0.5 * s
  for (let i = 0; i < 2; i++) {
    const lineY = tlY + 5.5 * s + i * 4 * s
    ctx.beginPath(); ctx.moveTo(tlX1, lineY); ctx.lineTo(tlX2, lineY); ctx.stroke()
  }
  ctx.restore()

  // SPINE
  ctx.strokeStyle = 'rgba(200,180,130,0.2)'; ctx.lineWidth = 0.9 * s
  ctx.beginPath()
  ctx.moveTo(lCx, lCy - lH / 2 + 1.5 * s); ctx.lineTo(lCx, lCy + lH / 2 - 1.5 * s)
  ctx.stroke()

  // RIGHT PAGE (separate save for page-turn rotation)
  ctx.save()
  ctx.translate(lCx, lCy); ctx.rotate(pageTurnAngle); ctx.translate(-lCx, -lCy)
  ctx.save()
  ctx.beginPath()
  ctx.rect(lCx + 1.5 * s, lCy - lH / 2 + 1.5 * s, lW / 2 - 2.5 * s, lH - 3 * s)
  ctx.clip()
  ctx.fillStyle = '#ddd6c0'
  ctx.fillRect(lCx + 1.5 * s, lCy - lH / 2 + 1.5 * s, lW / 2 - 2.5 * s, lH - 3 * s)

  // Ruled columns
  const rpX1 = lCx + 3 * s
  const rpX2 = lCx + lW / 2 - 2.5 * s
  const rpW = rpX2 - rpX1
  const headerY = lCy - lH / 2 + 5.5 * s
  ctx.strokeStyle = 'rgba(140,120,90,0.35)'; ctx.lineWidth = 0.6 * s
  ctx.beginPath(); ctx.moveTo(rpX1, headerY); ctx.lineTo(rpX2, headerY); ctx.stroke()
  for (let i = 1; i <= 2; i++) {
    const divX = rpX1 + i * rpW / 3
    ctx.beginPath(); ctx.moveTo(divX, headerY); ctx.lineTo(divX, lCy + lH / 2 - 2 * s); ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(140,120,90,0.18)'; ctx.lineWidth = 0.5 * s
  for (let i = 0; i < 3; i++) {
    const lineY = headerY + 4 * s + i * 4 * s
    ctx.beginPath(); ctx.moveTo(rpX1, lineY); ctx.lineTo(rpX2, lineY); ctx.stroke()
  }
  ctx.restore()

  // WAX SEAL
  const sealX = lCx + lW / 2 - 7 * s
  const sealY = lCy + lH / 2 - 7 * s

  if (state === 'done' && age < 1.0) {
    ctx.shadowBlur = 9 * s
    ctx.shadowColor = `rgba(212,84,26,${sealOpacity * 0.55})`
  }
  ctx.save()
  ctx.translate(sealX, sealY); ctx.scale(sealScale, sealScale)
  ctx.fillStyle = `rgba(${sealR},${sealG},${sealB},${sealOpacity})`
  ctx.beginPath(); ctx.arc(0, 0, 4.5 * s, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = `rgba(${sealR},${sealG},${sealB},${sealOpacity * 0.5})`
  ctx.lineWidth = 0.7 * s
  ctx.beginPath(); ctx.arc(0, 0, 4.5 * s, 0, Math.PI * 2); ctx.stroke()
  ctx.shadowBlur = 0
  if (state !== 'thinking') {
    ctx.strokeStyle = `rgba(10,8,6,${sealOpacity * 0.5})`
    ctx.lineWidth = 0.7 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(-1.5 * s, -1 * s); ctx.lineTo(0, 1.5 * s); ctx.lineTo(1.5 * s, -1 * s)
    ctx.stroke()
  }
  ctx.restore()

  ctx.restore() // right page turn
  ctx.restore() // ledger rotation
}

export function AvatarSteward({ size = 30, state = 'idle' }) {
  return <CanvasAvatar drawFn={drawSteward} size={size} state={state} />
}

// Generic fallback
export function AvatarGeneric({ initial = '?', size = 30 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: size * 0.4,
      color: 'rgba(255,255,255,0.55)',
    }}>{initial}</div>
  )
}
