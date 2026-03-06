'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor,
  useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove,
  horizontalListSortingStrategy, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateSticky, deleteSticky, updateColumn, deleteColumn } from '@/lib/stickies'

// ── Color palette ──────────────────────────────────────────────────────────────
const COLORS = {
  ember:    { bg:'#2a1008', border:'rgba(212,84,26,0.4)',    text:'#d4541a'                   },
  gold:     { bg:'#1e1600', border:'rgba(200,151,58,0.4)',   text:'#c8973a'                   },
  cyan:     { bg:'#001e1e', border:'rgba(58,212,200,0.4)',   text:'#3ad4c8'                   },
  paper:    { bg:'#1a1814', border:'rgba(240,236,228,0.15)', text:'#f0ece4'                   },
  charcoal: { bg:'#111009', border:'rgba(255,255,255,0.08)', text:'rgba(240,236,228,0.5)'     },
}
const COLOR_KEYS = Object.keys(COLORS)
const DRIFT_ANIMS = ['boardDrift0','boardDrift1','boardDrift2','boardDrift3']

// ── Sketch Overlay ────────────────────────────────────────────────────────────
function SketchOverlay({ sticky, onSave, onClose }) {
  const svgRef = useRef(null)
  const [paths, setPaths] = useState([])
  const [activePts, setActivePts] = useState(null)
  const drawing = useRef(false)
  const W = 220, H = 180
  const strokeColor = COLORS[sticky.color]?.text || '#f0ece4'

  function getXY(e) {
    const r = svgRef.current.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  function pts2d(pts) {
    if (!pts?.length) return ''
    return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}` +
      pts.slice(1).map(([x,y]) => ` L${x.toFixed(1)},${y.toFixed(1)}`).join('')
  }
  function onDown(e) { drawing.current = true; setActivePts([getXY(e)]) }
  function onMove(e) { if (!drawing.current) return; setActivePts(p => [...(p||[]), getXY(e)]) }
  function onUp() {
    if (drawing.current && activePts?.length > 1) {
      setPaths(p => [...p, pts2d(activePts)])
    }
    drawing.current = false; setActivePts(null)
  }
  function handleSave() {
    const all = [...paths, ...(activePts?.length > 1 ? [pts2d(activePts)] : [])]
    const pEls = all.map(d =>
      `<path d="${d}" stroke="${strokeColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    onSave(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${pEls.join('')}</svg>`)
  }
  const skBtn = { background:'transparent', border:'1px solid rgba(255,255,255,0.15)', borderRadius:2, color:'rgba(240,236,228,0.5)', fontFamily:"'Space Mono',monospace", fontSize:'.44rem', letterSpacing:'.1em', textTransform:'uppercase', padding:'.25rem .5rem', cursor:'none' }
  return (
    <div style={{ position:'absolute', inset:0, zIndex:200, background:'rgba(0,0,0,0.82)', borderRadius:4, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
      <svg ref={svgRef} width={W} height={H}
        style={{ background:'rgba(0,0,0,0.5)', borderRadius:4, cursor:'crosshair', touchAction:'none', userSelect:'none' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
        {paths.map((d,i) => <path key={i} d={d} stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
        {activePts?.length > 1 && <path d={pts2d(activePts)} stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={() => setPaths(p => p.slice(0,-1))} style={skBtn}>Undo</button>
        <button onClick={() => setPaths([])} style={skBtn}>Clear</button>
        <button onClick={handleSave} style={{ ...skBtn, color:strokeColor, borderColor:strokeColor }}>Save ✓</button>
        <button onClick={onClose} style={skBtn}>Cancel</button>
      </div>
    </div>
  )
}

// ── Sticky Card ────────────────────────────────────────────────────────────────
function StickyCard({ sticky, columnId, isIdle, onDelete, onUpdate, isDragOverlay }) {
  const [editing, setEditing] = useState(sticky.content === '' && sticky.source_type === 'manual')
  const [content, setContent] = useState(sticky.content || '')
  const [showSketch, setShowSketch] = useState(false)
  const [hovered, setHovered] = useState(false)
  const textRef = useRef(null)

  const col = COLORS[sticky.color] || COLORS.paper
  const driftAnim = DRIFT_ANIMS[sticky.id.charCodeAt(0) % 4]
  const driftDur = 8 + (sticky.id.charCodeAt(1) % 4)
  const driftDelay = -(sticky.id.charCodeAt(2) % 8)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sticky.id,
    data: { type: 'sticky', sticky, columnId },
    disabled: isDragOverlay || editing || showSketch,
  })

  useEffect(() => { if (editing) textRef.current?.focus() }, [editing])

  function saveContent() {
    setEditing(false)
    if (content !== sticky.content) onUpdate(sticky.id, { content })
  }

  const dndTransform = CSS.Transform.toString(transform)
  const rotation = sticky.rotation || 0

  const wrapperStyle = {
    '--rotation': `${rotation}deg`,
    animation: isIdle && !isDragging && !hovered
      ? `${driftAnim} ${driftDur}s ease-in-out ${driftDelay}s infinite`
      : 'none',
  }

  const cardStyle = {
    position: 'relative',
    transform: isDragging
      ? `${dndTransform || ''} rotate(0deg) scale(1.05)`
      : hovered && !isDragOverlay
      ? `rotate(0deg) scale(1.02)`
      : `${dndTransform || ''} rotate(${rotation}deg)`,
    transition: isDragging ? 'box-shadow .15s' : `transform .4s cubic-bezier(.16,1,.3,1), box-shadow .2s${transition ? ', ' + transition : ''}`,
    opacity: isDragging ? 0 : 1,
    width: '100%',
    background: col.bg,
    border: `1px solid ${col.border}`,
    borderRadius: 4,
    padding: '1.75rem .75rem .75rem',
    boxShadow: isDragging
      ? '0 16px 48px rgba(0,0,0,0.7)'
      : hovered ? '0 8px 28px rgba(0,0,0,0.55)'
      : '0 4px 16px rgba(0,0,0,0.4)',
    cursor: editing ? 'text' : 'none',
    minHeight: 80,
  }

  return (
    <div ref={setNodeRef} style={wrapperStyle} {...attributes}>
      <div style={cardStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => setEditing(true)}
        onAltClick={() => setShowSketch(true)}>

        {/* Tape strip */}
        <div style={{ position:'absolute', top:-4, left:'50%', transform:'translateX(-50%)', width:32, height:8, background:'rgba(240,236,228,0.15)', borderRadius:1, pointerEvents:'none' }} />

        {/* Drag handle */}
        <div {...listeners} style={{ position:'absolute', top:0, left:0, bottom:0, width:16, cursor:'grab', display:'flex', alignItems:'center', justifyContent:'center', opacity: hovered ? 0.3 : 0, transition:'opacity .2s' }}>
          <span style={{ fontSize:'.5rem', color:'rgba(240,236,228,0.6)', writingMode:'vertical-lr', letterSpacing:2 }}>⠿</span>
        </div>

        {/* Hover actions */}
        {hovered && !editing && (
          <div style={{ position:'absolute', top:6, right:6, display:'flex', gap:4, zIndex:10 }}>
            {sticky.source_type === 'lattice' && (
              <span title="Pinned from Lattice" style={{ fontSize:'.6rem', opacity:.5 }}>📌</span>
            )}
            <button onClick={() => setEditing(true)}
              style={{ background:'none', border:'none', color:'rgba(240,236,228,0.3)', fontSize:'.7rem', padding:'0 2px', lineHeight:1, cursor:'none', transition:'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color = col.text}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,236,228,0.3)'}>✎</button>
            <button onClick={() => setShowSketch(v => !v)}
              style={{ background:'none', border:'none', color:'rgba(240,236,228,0.3)', fontSize:'.65rem', padding:'0 2px', lineHeight:1, cursor:'none', transition:'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color = col.text}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,236,228,0.3)'}>✏</button>
            <button onClick={() => onDelete(sticky.id)}
              style={{ background:'none', border:'none', color:'rgba(240,236,228,0.3)', fontSize:'.7rem', padding:'0 2px', lineHeight:1, cursor:'none', transition:'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#d4541a'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,236,228,0.3)'}>🗑</button>
          </div>
        )}

        {/* Content */}
        {editing ? (
          <textarea ref={textRef} value={content} onChange={e => setContent(e.target.value)}
            onBlur={saveContent}
            onKeyDown={e => { if (e.key === 'Escape') saveContent() }}
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', resize:'none', fontFamily:"'Caveat',cursive", fontSize:'1.15rem', color:col.text, lineHeight:1.5, minHeight:60, paddingLeft:12 }} />
        ) : (
          <p style={{ fontFamily:"'Caveat',cursive", fontSize:'1.15rem', color:col.text, lineHeight:1.5, wordBreak:'break-word', whiteSpace:'pre-wrap', paddingLeft:12 }}>
            {content || <span style={{ opacity:.3, fontStyle:'italic' }}>empty</span>}
          </p>
        )}

        {/* Sketch SVG thumbnail */}
        {sticky.sketch_svg && !showSketch && (
          <div style={{ position:'absolute', bottom:28, right:8, opacity:.55, pointerEvents:'none' }}
            dangerouslySetInnerHTML={{ __html: sticky.sketch_svg
              .replace(/width="\d+"/, 'width="55"')
              .replace(/height="\d+"/, 'height="48"') }} />
        )}

        {/* Color picker row */}
        {editing && (
          <div style={{ display:'flex', gap:5, marginTop:8, paddingTop:6, borderTop:`1px solid ${col.border}` }}>
            {COLOR_KEYS.map(k => (
              <button key={k} onClick={() => onUpdate(sticky.id, { color: k })}
                style={{ width:12, height:12, borderRadius:'50%', background:COLORS[k].text, border: k === sticky.color ? '2px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.2)', cursor:'none', transition:'transform .15s', flexShrink:0 }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
            ))}
          </div>
        )}

        {/* Sketch overlay */}
        {showSketch && (
          <SketchOverlay sticky={sticky}
            onSave={svg => { onUpdate(sticky.id, { sketch_svg: svg }); setShowSketch(false) }}
            onClose={() => setShowSketch(false)} />
        )}
      </div>
    </div>
  )
}

// ── Column Drop Zone ──────────────────────────────────────────────────────────
function ColumnDropZone({ columnId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${columnId}`,
    data: { type: 'column-drop', columnId },
  })
  return (
    <div ref={setNodeRef} style={{ flex:1, minHeight:60,
      border: isOver ? '1px dashed rgba(212,84,26,0.4)' : '1px dashed rgba(255,255,255,0.06)',
      borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
      transition:'border-color .15s', marginTop: 4 }}>
      <span style={{ fontFamily:"'Space Mono',monospace", fontSize:'.75rem', color: isOver ? 'rgba(212,84,26,0.4)' : 'rgba(255,255,255,0.1)' }}>+</span>
    </div>
  )
}

// ── Board Column ──────────────────────────────────────────────────────────────
function BoardColumn({ column, colStickies, isIdle, onAddSticky, onDeleteSticky, onUpdateSticky, onDeleteColumn, onUpdateColumn }) {
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(column.name)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  })

  function saveName() {
    setEditingName(false)
    if (nameVal.trim() && nameVal !== column.name) onUpdateColumn(column.id, { name: nameVal.trim() })
  }

  return (
    <div ref={setNodeRef}
      style={{
        flexShrink: 0, width: 280, display:'flex', flexDirection:'column',
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.055)',
        borderRadius: 6,
        maxHeight: 'calc(100vh - 88px)',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}>

      {/* Column header */}
      <div style={{ padding:'.65rem .75rem', borderBottom:'1px solid rgba(255,255,255,0.055)', display:'flex', alignItems:'center', gap:'.45rem', flexShrink:0 }}>
        <div {...attributes} {...listeners} style={{ cursor:'grab', color:'rgba(255,255,255,0.18)', fontSize:'.65rem', flexShrink:0, paddingRight:2 }}>⠿</div>
        {editingName ? (
          <input value={nameVal} onChange={e => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(column.name); setEditingName(false) } }}
            autoFocus
            style={{ flex:1, background:'transparent', border:'none', outline:'none', fontFamily:"'Space Mono',monospace", fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,236,228,0.7)' }} />
        ) : (
          <span onDoubleClick={() => setEditingName(true)}
            style={{ flex:1, fontFamily:"'Space Mono',monospace", fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,236,228,0.45)', cursor:'none' }}>
            {column.name}
          </span>
        )}
        <span style={{ fontFamily:"'Space Mono',monospace", fontSize:'.42rem', letterSpacing:'.06em', color:'rgba(255,255,255,0.18)' }}>{colStickies.length}</span>
        <button onClick={() => onDeleteColumn(column.id, colStickies.length)}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.12)', fontSize:'.75rem', padding:'0 2px', lineHeight:1, cursor:'none', transition:'color .15s', flexShrink:0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#d4541a'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.12)'}>×</button>
      </div>

      {/* Stickies */}
      <div style={{ flex:1, overflowY:'auto', padding:'.75rem', display:'flex', flexDirection:'column', gap:'.75rem' }}>
        <SortableContext items={colStickies.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {colStickies.map(s => (
            <StickyCard key={s.id} sticky={s} columnId={column.id} isIdle={isIdle}
              onDelete={onDeleteSticky} onUpdate={onUpdateSticky} />
          ))}
        </SortableContext>
        {colStickies.length === 0 && <ColumnDropZone columnId={column.id} />}
      </div>

      {/* Add sticky */}
      <button onClick={() => onAddSticky(column.id)}
        style={{ margin:'.4rem .75rem .75rem', padding:'.4rem', background:'transparent', border:'1px dashed rgba(212,84,26,0.2)', borderRadius:3, color:'rgba(212,84,26,0.5)', fontFamily:"'Space Mono',monospace", fontSize:'.46rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .2s', cursor:'none', flexShrink:0 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,84,26,0.45)'; e.currentTarget.style.color = '#d4541a' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,84,26,0.2)'; e.currentTarget.style.color = 'rgba(212,84,26,0.5)' }}>
        + Add Sticky
      </button>
    </div>
  )
}

// ── Board TopBar ──────────────────────────────────────────────────────────────
function BoardTopBar({ stickyCount, onSignOut }) {
  return (
    <div style={{ height:44, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.25rem', borderBottom:'1px solid rgba(255,255,255,0.055)', background:'rgba(11,10,8,0.9)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', position:'relative', zIndex:100 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#d4541a', boxShadow:'0 0 10px rgba(212,84,26,0.5)', animation:'pulseSlow 3s ease-in-out infinite' }} />
        <span style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.1rem', fontWeight:300, fontStyle:'italic', color:'rgba(240,236,228,0.9)' }}>
          The <em style={{ color:'#d4541a' }}>Vault</em>
        </span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
        <a href="/vault/dashboard"
          style={{ fontFamily:"'Space Mono',monospace", fontSize:'.48rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,236,228,0.3)', textDecoration:'none', padding:'.3rem .65rem', border:'1px solid rgba(255,255,255,0.055)', borderRadius:4, transition:'all .2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,236,228,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,236,228,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.055)' }}>
          Workspace
        </a>
        <div style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.3rem .65rem', border:'1px solid rgba(212,84,26,0.3)', borderRadius:4, background:'rgba(212,84,26,0.06)' }}>
          <span style={{ fontFamily:"'Space Mono',monospace", fontSize:'.48rem', letterSpacing:'.14em', textTransform:'uppercase', color:'#d4541a' }}>Board</span>
          {stickyCount > 0 && (
            <span style={{ background:'#d4541a', color:'#0b0a08', borderRadius:3, padding:'0 .3rem', fontSize:'.44rem', fontWeight:700, lineHeight:'1.4' }}>{stickyCount}</span>
          )}
        </div>
      </div>

      <button onClick={onSignOut}
        style={{ fontFamily:"'Space Mono',monospace", fontSize:'.46rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,236,228,0.25)', background:'transparent', border:'1px solid rgba(255,255,255,0.055)', borderRadius:4, padding:'.3rem .65rem', cursor:'none', transition:'all .2s' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,236,228,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,236,228,0.25)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.055)' }}>
        Out
      </button>
    </div>
  )
}

// ── Board Page ────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const supabaseRef = useRef(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const [user, setUser] = useState(null)
  const [columns, setColumns] = useState([])
  const [stickies, setStickies] = useState([])
  const [mounted, setMounted] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [activeItem, setActiveItem] = useState(null)
  const [isIdle, setIsIdle] = useState(false)
  const idleRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // ── Idle ──
  function resetIdle() {
    setIsIdle(false)
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => setIsIdle(true), 30000)
  }

  useEffect(() => {
    resetIdle()
    window.addEventListener('mousemove', resetIdle, { passive: true })
    window.addEventListener('keydown', resetIdle, { passive: true })
    return () => {
      clearTimeout(idleRef.current)
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
    }
  }, []) // eslint-disable-line

  // ── Auth + load ──
  useEffect(() => {
    let active = true
    let initialized = false
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(async (_, session) => {
      if (!session) { window.location.href = '/vault/login'; return }
      if (initialized || !active) return
      initialized = true
      const uid = session.user.id
      setUser(session.user)
      const sb = getSupabase()
      try {
        const [colsRes, sticsRes] = await Promise.all([
          sb.from('sticky_columns').select('*').eq('user_id', uid).order('position'),
          sb.from('stickies').select('*').eq('user_id', uid).order('position'),
        ])
        if (colsRes.error) console.error('sticky_columns fetch error:', colsRes.error)
        if (sticsRes.error) console.error('stickies fetch error:', sticsRes.error)
        if (!active) return
        setColumns(colsRes.data || [])
        setStickies(sticsRes.data || [])
      } catch (err) {
        console.error('Board load error:', err)
        if (active) setLoadError(err?.message || 'Failed to load board')
      } finally {
        if (active) setMounted(true)
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, []) // eslint-disable-line

  // ── Hotkey: S ──
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 's' || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (columns.length === 0) {
        handleAddColumn().then(col => { if (col) handleAddSticky(col.id) })
      } else {
        handleAddSticky(columns[0].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [columns, user]) // eslint-disable-line

  // ── CRUD ──
  async function handleAddColumn() {
    if (!user) return null
    const position = columns.length
    const { data } = await getSupabase().from('sticky_columns')
      .insert({ user_id: user.id, name: 'New Column', position }).select().single()
    if (data) { setColumns(prev => [...prev, data]); return data }
    return null
  }

  async function handleUpdateColumn(id, updates) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    await updateColumn(getSupabase(), id, updates)
  }

  async function handleDeleteColumn(id, count) {
    if (count > 0 && !window.confirm(`Delete column and its ${count} stickies?`)) return
    setColumns(prev => prev.filter(c => c.id !== id))
    setStickies(prev => prev.filter(s => s.column_id !== id))
    await deleteColumn(getSupabase(), id)
  }

  async function handleAddSticky(colId) {
    if (!user) return
    const rotation = parseFloat((Math.random() * 6 - 3).toFixed(2))
    const position = stickies.filter(s => s.column_id === colId).length
    const { data } = await getSupabase().from('stickies').insert({
      user_id: user.id, column_id: colId, content: '', color: 'paper',
      rotation, position, source_type: 'manual',
    }).select().single()
    if (data) setStickies(prev => [...prev, data])
  }

  async function handleUpdateSticky(id, updates) {
    setStickies(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    await updateSticky(getSupabase(), id, updates)
  }

  async function handleDeleteSticky(id) {
    setStickies(prev => prev.filter(s => s.id !== id))
    await deleteSticky(getSupabase(), id)
  }

  // ── DnD ──
  function onDragStart({ active }) {
    const t = active.data.current?.type
    setActiveItem(
      t === 'sticky' ? { type:'sticky', data: active.data.current.sticky } :
      t === 'column' ? { type:'column', data: active.data.current.column } : null
    )
  }

  function onDragOver({ active, over }) {
    if (!over || active.data.current?.type !== 'sticky') return
    const s = active.data.current.sticky
    const overType = over.data.current?.type
    const targetColId = overType === 'sticky' ? over.data.current.columnId
      : overType === 'column-drop' ? over.data.current.columnId : null
    if (targetColId && targetColId !== s.column_id) {
      setStickies(prev => prev.map(x => x.id === s.id ? { ...x, column_id: targetColId } : x))
    }
  }

  function onDragEnd({ active, over }) {
    setActiveItem(null)
    if (!over) return
    const activeType = active.data.current?.type

    if (activeType === 'column') {
      const oldIdx = columns.findIndex(c => c.id === active.id)
      const newIdx = columns.findIndex(c => c.id === over.id)
      if (oldIdx !== newIdx) {
        const reordered = arrayMove(columns, oldIdx, newIdx)
        setColumns(reordered)
        reordered.forEach((c, i) => updateColumn(getSupabase(), c.id, { position: i }))
      }
      return
    }

    if (activeType === 'sticky') {
      const movedSticky = stickies.find(x => x.id === active.id)
      if (!movedSticky) return
      const overType = over.data.current?.type
      const targetColId = overType === 'sticky' ? over.data.current.columnId
        : overType === 'column-drop' ? over.data.current.columnId
        : movedSticky.column_id

      const colStickies = stickies
        .filter(x => x.column_id === targetColId && x.id !== active.id)
        .sort((a,b) => a.position - b.position)
      const overIdx = overType === 'sticky'
        ? colStickies.findIndex(x => x.id === over.id)
        : colStickies.length

      const inserted = [
        ...colStickies.slice(0, overIdx + 1),
        { ...movedSticky, column_id: targetColId },
        ...colStickies.slice(overIdx + 1),
      ]
      setStickies(prev => [
        ...prev.filter(x => x.column_id !== targetColId && x.id !== active.id),
        ...inserted,
      ])
      inserted.forEach((x, i) => updateSticky(getSupabase(), x.id, { position: i, column_id: targetColId }))
    }
  }

  if (!mounted) return (
    <div style={{ minHeight:'100vh', background:'#0b0a08', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ fontFamily:"'Space Mono',monospace", fontSize:'.52rem', letterSpacing:'.18em', textTransform:'uppercase', color:'rgba(240,236,228,0.25)' }}>
        {loadError ? `Error: ${loadError}` : 'Loading board…'}
      </p>
    </div>
  )

  const sortedColumns = [...columns].sort((a,b) => a.position - b.position)

  // Active drag overlay item
  const overlaySticky = activeItem?.type === 'sticky' ? stickies.find(s => s.id === activeItem.data.id) || activeItem.data : null
  const overlayColumn = activeItem?.type === 'column' ? activeItem.data : null

  return (
    <div style={{
      height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: '#0b0a08', position: 'relative',
      backgroundImage: [
        'linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px)',
        'linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px)',
        'linear-gradient(rgba(255,255,255,.005) 1px,transparent 1px)',
        'linear-gradient(90deg,rgba(255,255,255,.005) 1px,transparent 1px)',
      ].join(','),
      backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
    }}>
      <BoardTopBar stickyCount={stickies.length}
        onSignOut={async () => { await getSupabase().auth.signOut(); window.location.href = '/vault/login' }} />

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>

        <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', display:'flex', alignItems:'flex-start', padding:'1.25rem', gap:'1rem' }}>
          <SortableContext items={sortedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {sortedColumns.map(col => {
              const colStickies = stickies
                .filter(s => s.column_id === col.id)
                .sort((a,b) => a.position - b.position)
              return (
                <BoardColumn key={col.id} column={col} colStickies={colStickies} isIdle={isIdle}
                  onAddSticky={handleAddSticky}
                  onDeleteSticky={handleDeleteSticky}
                  onUpdateSticky={handleUpdateSticky}
                  onDeleteColumn={handleDeleteColumn}
                  onUpdateColumn={handleUpdateColumn} />
              )
            })}
          </SortableContext>

          {/* Add column */}
          <button onClick={handleAddColumn}
            style={{ flexShrink:0, width:240, minHeight:120, background:'transparent', border:'1px dashed rgba(255,255,255,0.06)', borderRadius:6, color:'rgba(255,255,255,0.18)', fontFamily:"'Space Mono',monospace", fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', cursor:'none', transition:'all .2s', alignSelf:'stretch', display:'flex', alignItems:'center', justifyContent:'center', gap:'.4rem' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,84,26,0.3)'; e.currentTarget.style.color = 'rgba(212,84,26,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.18)' }}>
            + Add Column
          </button>

          {/* Empty state */}
          {sortedColumns.length === 0 && (
            <div style={{ position:'absolute', inset:44, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontFamily:"'Caveat',cursive", fontSize:'2rem', color:'rgba(240,236,228,0.12)', fontStyle:'italic', lineHeight:1.3 }}>
                  Nothing here yet.<br />Press S to create your first sticky.
                </p>
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {overlaySticky && (
            <div style={{ width:280, opacity:.9 }}>
              <StickyCard sticky={overlaySticky} columnId={overlaySticky.column_id}
                isIdle={false} onDelete={() => {}} onUpdate={() => {}} isDragOverlay />
            </div>
          )}
          {overlayColumn && (
            <div style={{ width:280, height:200, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, opacity:.7 }} />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
