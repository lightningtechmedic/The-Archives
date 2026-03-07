'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
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
import TheGuideWidget from '@/components/TheGuideWidget'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/vault'

// ── Palette ───────────────────────────────────────────────────────────────────
const COLORS = {
  ember:    { bg:'#2a1008', border:'rgba(212,84,26,0.4)',    text:'#d4541a' },
  gold:     { bg:'#1e1600', border:'rgba(200,151,58,0.4)',   text:'#c8973a' },
  cyan:     { bg:'#001e1e', border:'rgba(58,212,200,0.4)',   text:'#3ad4c8' },
  paper:    { bg:'#1a1814', border:'rgba(240,236,228,0.15)', text:'#f0ece4' },
  charcoal: { bg:'#111009', border:'rgba(255,255,255,0.08)', text:'rgba(240,236,228,0.5)' },
}
const COLOR_KEYS    = Object.keys(COLORS)
const DRIFT_ANIMS   = ['boardDrift0','boardDrift1','boardDrift2','boardDrift3']
const DONE_NAMES    = new Set(['done','✓ done','complete','finished','✅ done','✓done'])
const COL_TYPES     = ['freeform','pipeline','date-sorted','priority','archive']
const COL_TYPE_LABELS = { freeform:'Freeform', pipeline:'Pipeline', 'date-sorted':'By Date', priority:'Priority', archive:'Archive' }

// ── Detection ─────────────────────────────────────────────────────────────────
const DATE_RES = [
  /\b(today|tomorrow|yesterday)\b/i,
  /\b(this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bnext\s+(week|monday|tuesday|wednesday|thursday|friday)\b/i,
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\b/i,
  /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/,
  /\b(eod|end\s+of\s+(?:day|week))\b/i,
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
]
function detectDate(text)    { for (const r of DATE_RES) { const m = text.match(r); if (m) return m[0] } return null }
function detectTags(text)    { return [...new Set((text.match(/#([a-z0-9_]+)/gi)||[]).map(t=>t.slice(1).toLowerCase()))] }
function detectUrls(text)    { return (text.match(/https?:\/\/[^\s]+/gi)||[]).map(u=>{ try{return new URL(u).hostname}catch{return u.slice(0,28)} }) }
function detectMetrics(text) {
  const res=[]
  ;[[/\$[\d,.]+[km]?\b/gi,'💰'],[/\b\d+(?:\.\d+)?%/g,'📈'],[/\b\d+(?:\.\d+)?x\b/gi,'🔢']].forEach(([re,icon])=>{
    ;(text.match(re)||[]).forEach(m=>res.push({icon,label:m}))
  })
  return res
}
function detectMentions(text) { return (text.match(/@([a-z0-9._]+)/gi)||[]).map(m=>m.slice(1)) }
function detectNoteMatch(text, notes) {
  if (!notes?.length) return null
  const lower = text.toLowerCase()
  return notes.find(n => n.title && n.title.length >= 3 && lower.includes(n.title.toLowerCase())) || null
}
function tagColor(tag) {
  let h=0; for (const c of tag) h=(h*31+c.charCodeAt(0))&0xffffffff
  const hue = Math.abs(h)%360
  return { bg:`hsla(${hue},55%,45%,.15)`, text:`hsl(${hue},65%,62%)`, border:`hsla(${hue},55%,45%,.3)` }
}
function wordCount(t) { return (t.trim().match(/\S+/g)||[]).length }
function isStale(s) {
  const ts = s.updated_at || s.created_at
  if (!ts) return false
  const age = (Date.now() - new Date(ts).getTime()) / 86400000
  return age > 14 && !s.tags?.length && !s.detected_date && !s.note_link_id && !s.shared_with?.length
}
function isDoneCol(name) { return DONE_NAMES.has((name||'').toLowerCase().trim()) }

// ── Confetti ──────────────────────────────────────────────────────────────────
async function fireConfetti(originEl) {
  try {
    const mod = await import('canvas-confetti')
    const confetti = mod.default || mod
    const r = originEl?.getBoundingClientRect()
    const x = r ? (r.left + r.width/2) / window.innerWidth  : 0.5
    const y = r ? (r.top  + r.height/2) / window.innerHeight : 0.6
    confetti({ particleCount:12, spread:65, gravity:1.2, scalar:0.75, ticks:60,
      origin:{x,y}, colors:['#d4541a','#c8973a','#f0ece4','#3ad4c8','#50c864'] })
  } catch {}
}

// ── StickyChip ────────────────────────────────────────────────────────────────
const CHIP_C = {
  date:   {bg:'rgba(212,84,26,.15)',   text:'#d4541a',             border:'rgba(212,84,26,.3)'},
  note:   {bg:'rgba(200,151,58,.15)',  text:'#c8973a',             border:'rgba(200,151,58,.3)'},
  person: {bg:'rgba(58,212,200,.15)',  text:'#3ad4c8',             border:'rgba(58,212,200,.3)'},
  url:    {bg:'rgba(255,255,255,.06)', text:'rgba(240,236,228,.5)',border:'rgba(255,255,255,.1)'},
  metric: {bg:'rgba(80,200,100,.15)',  text:'#50c864',             border:'rgba(80,200,100,.3)'},
}
function StickyChip({ type, tag, label, icon, onClick, onRemove }) {
  const c = type==='tag' ? tagColor(tag||label) : (CHIP_C[type]||CHIP_C.url)
  return (
    <span onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:'.15rem',
      background:c.bg, color:c.text, border:`1px solid ${c.border}`,
      borderRadius:100, padding:'.08rem .35rem',
      fontFamily:"var(--font-mono),monospace", fontSize:'.4rem', letterSpacing:'.07em',
      cursor:onClick?'none':'default', whiteSpace:'nowrap', flexShrink:0,
      maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', transition:'opacity .15s',
    }}>
      {icon && <span style={{marginRight:'.1rem'}}>{icon}</span>}
      {label}
      {onRemove && <span onClick={e=>{e.stopPropagation();onRemove()}} style={{marginLeft:'.1rem',opacity:.45,cursor:'none'}}>×</span>}
    </span>
  )
}

// ── Sketch Overlay ────────────────────────────────────────────────────────────
function SketchOverlay({ sticky, onSave, onClose }) {
  const svgRef = useRef(null)
  const [paths, setPaths] = useState([])
  const [activePts, setActivePts] = useState(null)
  const drawing = useRef(false)
  const W=220, H=180
  const strokeColor = COLORS[sticky.color]?.text||'#f0ece4'
  function getXY(e){const r=svgRef.current.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
  function pts2d(pts){if(!pts?.length)return'';return`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`+pts.slice(1).map(([x,y])=>` L${x.toFixed(1)},${y.toFixed(1)}`).join('')}
  function onDown(e){drawing.current=true;setActivePts([getXY(e)])}
  function onMove(e){if(!drawing.current)return;setActivePts(p=>[...(p||[]),getXY(e)])}
  function onUp(){if(drawing.current&&activePts?.length>1)setPaths(p=>[...p,pts2d(activePts)]);drawing.current=false;setActivePts(null)}
  function handleSave(){
    const all=[...paths,...(activePts?.length>1?[pts2d(activePts)]:[])];
    const pEls=all.map(d=>`<path d="${d}" stroke="${strokeColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    onSave(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${pEls.join('')}</svg>`)
  }
  const skBtn={background:'transparent',border:'1px solid rgba(255,255,255,0.15)',borderRadius:2,color:'rgba(240,236,228,0.5)',fontFamily:"var(--font-mono),monospace",fontSize:'.44rem',letterSpacing:'.1em',textTransform:'uppercase',padding:'.25rem .5rem',cursor:'none'}
  return (
    <div style={{position:'absolute',inset:0,zIndex:200,background:'rgba(0,0,0,0.82)',borderRadius:4,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
      <svg ref={svgRef} width={W} height={H} style={{background:'rgba(0,0,0,0.5)',borderRadius:4,cursor:'crosshair',touchAction:'none',userSelect:'none'}}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
        {paths.map((d,i)=><path key={i} d={d} stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}
        {activePts?.length>1&&<path d={pts2d(activePts)} stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
      <div style={{display:'flex',gap:6}}>
        <button onClick={()=>setPaths(p=>p.slice(0,-1))} style={skBtn}>Undo</button>
        <button onClick={()=>setPaths([])} style={skBtn}>Clear</button>
        <button onClick={handleSave} style={{...skBtn,color:strokeColor,borderColor:strokeColor}}>Save ✓</button>
        <button onClick={onClose} style={skBtn}>Cancel</button>
      </div>
    </div>
  )
}

// ── Sticky Card ────────────────────────────────────────────────────────────────
function StickyCard({ sticky, columnId, isIdle, onDelete, onUpdate, isDragOverlay, inkMode, focused, colType, positionInCol, totalInCol, notes, onOpenNote }) {
  const [editing,    setEditing]    = useState(sticky.content===''&&sticky.source_type==='manual')
  const [content,    setContent]    = useState(sticky.content||'')
  const [showSketch, setShowSketch] = useState(false)
  const [hovered,    setHovered]    = useState(false)
  const [staleHover, setStaleHover] = useState(false)
  const [noteSugg,   setNoteSugg]   = useState(null)   // note match suggestion
  const [dismissed,  setDismissed]  = useState(false)  // dismissed suggestion
  const textRef = useRef(null)
  const detectTimer = useRef(null)

  const col         = COLORS[sticky.color]||COLORS.paper
  const driftAnim   = DRIFT_ANIMS[sticky.id.charCodeAt(0)%4]
  const driftDur    = 8 + (sticky.id.charCodeAt(1)%4)
  const driftDelay  = -(sticky.id.charCodeAt(2)%8)
  const stale       = isStale(sticky)
  const wc          = wordCount(content)
  const weightShadow = wc<=10 ? '0 2px 8px rgba(0,0,0,0.3)' : wc<=25 ? '0 4px 16px rgba(0,0,0,0.4)' : '0 6px 24px rgba(0,0,0,0.5)'

  // Derive chips from content
  const dateLabel  = detectDate(content)
  const tags       = detectTags(content)
  const urls       = detectUrls(content)
  const metrics    = detectMetrics(content)
  const mentions   = detectMentions(content)
  const noteLinkTitle = sticky.note_link_id && notes ? notes.find(n=>n.id===sticky.note_link_id)?.title : null

  // Smart detection debounce
  useEffect(() => {
    clearTimeout(detectTimer.current)
    if (!editing) return
    detectTimer.current = setTimeout(() => {
      // Note link suggestion
      if (!sticky.note_link_id && !dismissed) {
        const match = detectNoteMatch(content, notes)
        setNoteSugg(match && match.id !== sticky.note_link_id ? match : null)
      }
      // Persist tags to DB (debounced at 800ms, extend here)
      const newTags = detectTags(content)
      const existingTags = sticky.tags||[]
      const changed = newTags.length!==existingTags.length || newTags.some(t=>!existingTags.includes(t))
      if (changed) {
        onUpdate(sticky.id, { tags: newTags, updated_at: new Date().toISOString() })
      }
    }, 300)
    return () => clearTimeout(detectTimer.current)
  }, [content, editing]) // eslint-disable-line

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sticky.id,
    data: { type:'sticky', sticky, columnId },
    disabled: isDragOverlay||editing||showSketch,
  })

  useEffect(() => { if (editing) textRef.current?.focus() }, [editing])

  function saveContent() {
    setEditing(false)
    if (content !== sticky.content) {
      onUpdate(sticky.id, { content, updated_at: new Date().toISOString() })
    }
  }

  // Column-type border modifier
  let borderOverride = col.border
  if (colType==='priority' && positionInCol===0) borderOverride = 'rgba(212,84,26,0.7)'
  else if (colType==='priority' && positionInCol===1) borderOverride = 'rgba(212,84,26,0.45)'

  const opacity = colType==='archive' ? 0.4 : (stale && !hovered ? 0.6 : (isDragging ? 0 : 1))

  const cardStyle = {
    position:'relative',
    transform: isDragging ? `${CSS.Transform.toString(transform)||''} rotate(0deg) scale(1.05)`
      : hovered&&!isDragOverlay ? `rotate(0deg) scale(1.02)`
      : `${CSS.Transform.toString(transform)||''} rotate(${sticky.rotation||0}deg)`,
    transition: isDragging ? 'box-shadow .15s' : `transform .4s cubic-bezier(.16,1,.3,1), box-shadow .2s${transition?', '+transition:''}`,
    opacity,
    width:'100%',
    background: col.bg,
    border: `1px solid ${stale ? 'rgba(255,255,255,0.08)' : borderOverride}`,
    borderStyle: stale ? 'dashed' : 'solid',
    borderRadius: inkMode ? 2 : 4,
    padding: colType==='archive' ? '.6rem .75rem .5rem' : '1.75rem .75rem .75rem',
    boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.55)' : weightShadow,
    cursor: editing ? 'text' : 'none',
    minHeight: colType==='archive' ? 40 : 80,
    filter: inkMode ? 'url(#rough-paper)' : 'none',
  }

  const wrapStyle = {
    '--rotation': `${sticky.rotation||0}deg`,
    animation: isIdle&&!isDragging&&!hovered&&!focused
      ? `${driftAnim} ${driftDur}s ease-in-out ${driftDelay}s infinite` : 'none',
  }

  // All visible chips (capped at 4, +N overflow)
  const allChips = [
    ...(noteLinkTitle ? [{ type:'note', label:`🔗 ${noteLinkTitle}`, key:'note-link', onClick:()=>onOpenNote?.(sticky.note_link_id) }] : []),
    ...(dateLabel ? [{ type:'date', label:`📅 ${dateLabel}`, key:'date' }] : []),
    ...(tags.slice(0,3).map(t=>({ type:'tag', tag:t, label:`#${t}`, key:`tag-${t}` }))),
    ...(metrics.slice(0,2).map((m,i)=>({ type:'metric', label:`${m.icon} ${m.label}`, key:`metric-${i}` }))),
    ...(urls.slice(0,1).map(u=>({ type:'url', label:`🔗 ${u}`, key:`url-${u}` }))),
    ...(mentions.slice(0,2).map(m=>({ type:'person', label:`@${m}`, key:`mention-${m}` }))),
  ]
  const shownChips = allChips.slice(0, 4)
  const extraChips = allChips.length - 4

  return (
    <div ref={setNodeRef} style={wrapStyle} {...attributes}>
      <div style={cardStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => !isDragOverlay && setEditing(true)}>

        {/* Tape strip */}
        <div style={{position:'absolute',top:-4,left:'50%',transform:'translateX(-50%)',width:32,height:8,background:'rgba(240,236,228,0.15)',borderRadius:1,pointerEvents:'none'}} />

        {/* Drag handle */}
        <div {...listeners} style={{position:'absolute',top:0,left:0,bottom:0,width:16,cursor:'grab',display:'flex',alignItems:'center',justifyContent:'center',opacity:hovered?0.3:0,transition:'opacity .2s'}}>
          <span style={{fontSize:'.5rem',color:'rgba(240,236,228,0.6)',writingMode:'vertical-lr',letterSpacing:2}}>⠿</span>
        </div>

        {/* Pipeline progress bar */}
        {colType==='pipeline' && totalInCol > 1 && (
          <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'rgba(255,255,255,0.05)'}}>
            <div style={{height:'100%',background:col.text,opacity:0.5,width:`${((totalInCol-1-positionInCol)/(totalInCol-1))*100}%`,transition:'width .3s'}} />
          </div>
        )}

        {/* Hover actions */}
        {hovered && !editing && (
          <div style={{position:'absolute',top:6,right:6,display:'flex',gap:4,zIndex:10}}>
            {sticky.source_type==='lattice' && <span title="From Lattice" style={{fontSize:'.6rem',opacity:.5}}>📌</span>}
            <button onClick={()=>setEditing(true)} style={{background:'none',border:'none',color:'rgba(240,236,228,0.3)',fontSize:'.7rem',padding:'0 2px',lineHeight:1,cursor:'none',transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color=col.text} onMouseLeave={e=>e.currentTarget.style.color='rgba(240,236,228,0.3)'}>✎</button>
            <button onClick={()=>setShowSketch(v=>!v)} style={{background:'none',border:'none',color:'rgba(240,236,228,0.3)',fontSize:'.65rem',padding:'0 2px',lineHeight:1,cursor:'none',transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color=col.text} onMouseLeave={e=>e.currentTarget.style.color='rgba(240,236,228,0.3)'}>✏</button>
            <button onClick={()=>onDelete(sticky.id)} style={{background:'none',border:'none',color:'rgba(240,236,228,0.3)',fontSize:'.7rem',padding:'0 2px',lineHeight:1,cursor:'none',transition:'color .15s'}} onMouseEnter={e=>e.currentTarget.style.color='#d4541a'} onMouseLeave={e=>e.currentTarget.style.color='rgba(240,236,228,0.3)'}>🗑</button>
          </div>
        )}

        {/* Stale hover prompt */}
        {stale && hovered && (
          <div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(0,0,0,0.75)',borderRadius:'0 0 4px 4px',padding:'.3rem .5rem',display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:20}}>
            <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.38rem',color:'rgba(240,236,228,0.35)',letterSpacing:'.08em'}}>Still relevant?</span>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>onUpdate(sticky.id,{updated_at:new Date().toISOString()})} style={{background:'none',border:'none',color:'rgba(80,200,100,0.7)',fontFamily:"var(--font-mono),monospace",fontSize:'.38rem',cursor:'none',letterSpacing:'.06em'}}>↵ keep</button>
              <button onClick={()=>onUpdate(sticky.id,{color:'charcoal',updated_at:new Date().toISOString()})} style={{background:'none',border:'none',color:'rgba(212,84,26,0.6)',fontFamily:"var(--font-mono),monospace",fontSize:'.38rem',cursor:'none',letterSpacing:'.06em'}}>✕ archive</button>
            </div>
          </div>
        )}

        {/* Content */}
        {editing ? (
          <textarea ref={textRef} value={content} onChange={e=>setContent(e.target.value)}
            onBlur={saveContent}
            onKeyDown={e=>{
              if(e.key==='Escape') saveContent()
              if(e.key==='Tab'){ e.preventDefault(); saveContent() }
            }}
            style={{width:'100%',background:'transparent',border:'none',outline:'none',resize:'none',fontFamily:"'Caveat',cursive",fontSize: inkMode?'1.25rem':'1.15rem',fontWeight:inkMode?700:400,color:col.text,lineHeight:1.5,minHeight:60,paddingLeft:12}} />
        ) : (
          <p style={{fontFamily:"'Caveat',cursive",fontSize:inkMode?'1.2rem':'1.1rem',fontWeight:inkMode?700:400,color:col.text,lineHeight:1.5,wordBreak:'break-word',whiteSpace:'pre-wrap',paddingLeft:12}}>
            {content||<span style={{opacity:.3,fontStyle:'italic'}}>empty</span>}
          </p>
        )}

        {/* Note link suggestion */}
        {noteSugg && editing && !dismissed && (
          <div style={{margin:'6px 0 0 12px',display:'flex',alignItems:'center',gap:6,padding:'.25rem .45rem',background:'rgba(200,151,58,0.1)',border:'1px solid rgba(200,151,58,0.3)',borderRadius:4}}>
            <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.4rem',color:'#c8973a',letterSpacing:'.06em'}}>🔗 Link to "{noteSugg.title}"?</span>
            <button onClick={()=>{onUpdate(sticky.id,{note_link_id:noteSugg.id,updated_at:new Date().toISOString()});setNoteSugg(null)}} style={{background:'rgba(200,151,58,0.2)',border:'none',color:'#c8973a',fontFamily:"var(--font-mono),monospace",fontSize:'.38rem',padding:'.1rem .3rem',borderRadius:2,cursor:'none'}}>Link</button>
            <button onClick={()=>{setDismissed(true);setNoteSugg(null)}} style={{background:'none',border:'none',color:'rgba(240,236,228,0.3)',fontFamily:"var(--font-mono),monospace",fontSize:'.38rem',cursor:'none'}}>✕</button>
          </div>
        )}

        {/* Sketch SVG thumbnail */}
        {sticky.sketch_svg && !showSketch && (
          <div style={{position:'absolute',bottom:28,right:8,opacity:.55,pointerEvents:'none'}}
            dangerouslySetInnerHTML={{__html:sticky.sketch_svg.replace(/width="\d+"/,'width="55"').replace(/height="\d+"/,'height="48"')}} />
        )}

        {/* Color picker (while editing) */}
        {editing && (
          <div style={{display:'flex',gap:5,marginTop:8,paddingTop:6,borderTop:`1px solid ${col.border}`}}>
            {COLOR_KEYS.map(k=>(
              <button key={k} onClick={()=>onUpdate(sticky.id,{color:k})}
                style={{width:12,height:12,borderRadius:'50%',background:COLORS[k].text,border:k===sticky.color?'2px solid rgba(255,255,255,0.6)':'1px solid rgba(255,255,255,0.2)',cursor:'none',transition:'transform .15s',flexShrink:0}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.3)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'} />
            ))}
          </div>
        )}

        {/* Chips row */}
        {allChips.length > 0 && !editing && (
          <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:6,paddingLeft:12}}>
            {shownChips.map(chip=>(
              <StickyChip key={chip.key} type={chip.type} tag={chip.tag} label={chip.label} icon={chip.icon} onClick={chip.onClick} />
            ))}
            {extraChips > 0 && (
              <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.38rem',color:'rgba(240,236,228,0.3)',padding:'.08rem .25rem'}}>+{extraChips} more</span>
            )}
            {noteLinkTitle && (
              <button onClick={()=>onUpdate(sticky.id,{note_link_id:null})} style={{background:'none',border:'none',color:'rgba(240,236,228,0.2)',fontSize:'.4rem',cursor:'none',padding:0}}>×link</button>
            )}
          </div>
        )}

        {/* Sketch overlay */}
        {showSketch && (
          <SketchOverlay sticky={sticky}
            onSave={svg=>{onUpdate(sticky.id,{sketch_svg:svg,updated_at:new Date().toISOString()});setShowSketch(false)}}
            onClose={()=>setShowSketch(false)} />
        )}
      </div>
    </div>
  )
}

// ── Column Drop Zone ──────────────────────────────────────────────────────────
function ColumnDropZone({ columnId }) {
  const { setNodeRef, isOver } = useDroppable({ id:`drop-${columnId}`, data:{type:'column-drop',columnId} })
  return (
    <div ref={setNodeRef} style={{flex:1,minHeight:60,border:isOver?'1px dashed rgba(212,84,26,0.4)':'1px dashed rgba(255,255,255,0.06)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',transition:'border-color .15s',marginTop:4}}>
      <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.75rem',color:isOver?'rgba(212,84,26,0.4)':'rgba(255,255,255,0.1)'}}>+</span>
    </div>
  )
}

// ── Tag Filter Bar ────────────────────────────────────────────────────────────
function TagFilterBar({ allTags, activeTags, onToggle, onClear }) {
  if (!allTags.length) return null
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'.5rem 1.25rem',borderBottom:'1px solid rgba(255,255,255,0.04)',flexWrap:'wrap',flexShrink:0}}>
      <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.44rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(240,236,228,0.25)',flexShrink:0}}>Filter:</span>
      {allTags.map(tag => {
        const active = activeTags.has(tag)
        const c = tagColor(tag)
        return (
          <button key={tag} onClick={()=>onToggle(tag)}
            style={{display:'inline-flex',alignItems:'center',gap:'.2rem',padding:'.18rem .5rem',borderRadius:100,border:`1px solid ${active?c.border:'rgba(255,255,255,0.08)'}`,background:active?c.bg:'transparent',color:active?c.text:'rgba(240,236,228,0.3)',fontFamily:"var(--font-mono),monospace",fontSize:'.42rem',letterSpacing:'.07em',cursor:'none',transition:'all .15s'}}>
            #{tag}
          </button>
        )
      })}
      {activeTags.size > 0 && (
        <button onClick={onClear} style={{background:'none',border:'none',color:'rgba(240,236,228,0.25)',fontFamily:"var(--font-mono),monospace",fontSize:'.42rem',letterSpacing:'.08em',cursor:'none',textTransform:'uppercase'}}>✕ clear</button>
      )}
    </div>
  )
}

// ── Summary / Prep Panel ──────────────────────────────────────────────────────
function AIPanel({ title, loading, text, onClose, onPin, avatar }) {
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:600,background:'rgba(11,10,8,0.97)',borderTop:'1px solid rgba(212,84,26,0.3)',padding:'1.25rem 1.5rem',maxHeight:'38vh',display:'flex',flexDirection:'column',gap:'.75rem',animation:'fadeUp .3s cubic-bezier(.16,1,.3,1)'}}>
      <div style={{display:'flex',alignItems:'center',gap:'.75rem',flexShrink:0}}>
        <span style={{fontSize:'1.1rem'}}>{avatar}</span>
        <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.52rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(212,84,26,0.8)'}}>{title}</span>
        <div style={{flex:1}}/>
        {text && !loading && (
          <button onClick={onPin} style={{fontFamily:"var(--font-mono),monospace",fontSize:'.46rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(240,236,228,0.4)',background:'transparent',border:'1px solid rgba(255,255,255,0.08)',borderRadius:3,padding:'.25rem .6rem',cursor:'none',transition:'all .2s'}} onMouseEnter={e=>{e.currentTarget.style.color='rgba(240,236,228,0.8)';e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'}} onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,228,0.4)';e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}}>
            Pin as sticky
          </button>
        )}
        <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(240,236,228,0.3)',fontSize:'1rem',cursor:'none',lineHeight:1}}>×</button>
      </div>
      <div style={{flex:1,overflowY:'auto',scrollbarWidth:'none'}}>
        {loading ? (
          <p style={{fontFamily:"var(--font-mono),monospace",fontSize:'.48rem',letterSpacing:'.12em',textTransform:'uppercase',color:'rgba(240,236,228,0.25)',animation:'pulseSlow 1.5s ease-in-out infinite'}}>thinking…</p>
        ) : (
          <p style={{fontFamily:"'Caveat',cursive",fontSize:'1.2rem',color:'rgba(240,236,228,0.8)',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{text}</p>
        )}
      </div>
    </div>
  )
}

// ── Board Column ──────────────────────────────────────────────────────────────
function BoardColumn({ column, colStickies, isIdle, onAddSticky, onDeleteSticky, onUpdateSticky, onDeleteColumn, onUpdateColumn, inkMode, focused, onFocusToggle, activeTags, notes, onOpenNote }) {
  const [editingName,  setEditingName]  = useState(false)
  const [nameVal,      setNameVal]      = useState(column.name)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const colType = column.type || 'freeform'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type:'column', column },
  })

  function saveName() {
    setEditingName(false)
    if (nameVal.trim() && nameVal !== column.name) onUpdateColumn(column.id, { name: nameVal.trim() })
  }

  // Apply date-sorted order for that column type
  let displayStickies = [...colStickies]
  if (colType === 'date-sorted') {
    displayStickies.sort((a,b) => {
      const da = a.detected_date ? new Date(a.detected_date) : null
      const db = b.detected_date ? new Date(b.detected_date) : null
      if (da && db) return da - db
      if (da) return -1
      if (db) return 1
      return a.position - b.position
    })
  }

  // Filter by active tags
  let filteredStickies = displayStickies
  if (activeTags.size > 0) {
    filteredStickies = displayStickies.filter(s =>
      [...activeTags].every(t => s.tags?.includes(t))
    )
  }

  const dimmed = !focused && false // managed by parent

  return (
    <div ref={setNodeRef}
      style={{
        flexShrink:0, width:280, display:'flex', flexDirection:'column',
        background:'rgba(255,255,255,0.01)',
        border:'1px solid rgba(255,255,255,0.055)',
        borderRadius:6,
        maxHeight:'calc(100vh - 108px)',
        transform:CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}>

      {/* Column header */}
      <div style={{padding:'.65rem .75rem',borderBottom:'1px solid rgba(255,255,255,0.055)',display:'flex',alignItems:'center',gap:'.45rem',flexShrink:0}}>
        <div {...attributes} {...listeners} style={{cursor:'grab',color:'rgba(255,255,255,0.18)',fontSize:'.65rem',flexShrink:0}}>⠿</div>

        {editingName ? (
          <input value={nameVal} onChange={e=>setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={e=>{if(e.key==='Enter')saveName();if(e.key==='Escape'){setNameVal(column.name);setEditingName(false)}}}
            autoFocus
            style={{flex:1,background:'transparent',border:'none',outline:'none',fontFamily:"var(--font-mono),monospace",fontSize:'.5rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(240,236,228,0.7)'}} />
        ) : (
          <span onDoubleClick={()=>setEditingName(true)}
            style={{flex:1,fontFamily:"var(--font-mono),monospace",fontSize:'.5rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(240,236,228,0.45)',cursor:'none'}}>
            {column.name}
          </span>
        )}

        <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.42rem',color:'rgba(255,255,255,0.18)'}}>{colStickies.length}</span>

        {/* Type pill */}
        <div style={{position:'relative'}}>
          <button onClick={()=>setShowTypeMenu(v=>!v)}
            style={{background:'transparent',border:'1px solid rgba(255,255,255,0.07)',borderRadius:3,color:'rgba(255,255,255,0.25)',fontFamily:"var(--font-mono),monospace",fontSize:'.38rem',letterSpacing:'.06em',padding:'.1rem .3rem',cursor:'none',transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.15)';e.currentTarget.style.color='rgba(255,255,255,0.6)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';e.currentTarget.style.color='rgba(255,255,255,0.25)'}}>
            {colType}
          </button>
          {showTypeMenu && (
            <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,zIndex:500,background:'rgba(11,10,8,0.98)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:4,overflow:'hidden',minWidth:110,boxShadow:'0 8px 32px rgba(0,0,0,0.7)'}}>
              {COL_TYPES.map(t=>(
                <button key={t} onClick={()=>{onUpdateColumn(column.id,{type:t});setShowTypeMenu(false)}}
                  style={{width:'100%',padding:'.45rem .65rem',background:colType===t?'rgba(212,84,26,0.08)':'transparent',color:colType===t?'#d4541a':'rgba(240,236,228,0.45)',fontFamily:"var(--font-mono),monospace",fontSize:'.44rem',letterSpacing:'.08em',textAlign:'left',display:'block',transition:'background .1s',cursor:'none'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                  onMouseLeave={e=>e.currentTarget.style.background=colType===t?'rgba(212,84,26,0.08)':'transparent'}>
                  {COL_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Focus button */}
        <button onClick={onFocusToggle}
          title={focused ? 'Exit focus' : 'Focus this column'}
          style={{background:'none',border:'none',color:focused?'rgba(212,84,26,0.7)':'rgba(255,255,255,0.12)',fontSize:'.65rem',padding:'0 2px',lineHeight:1,cursor:'none',transition:'color .15s'}}
          onMouseEnter={e=>e.currentTarget.style.color=focused?'#d4541a':'rgba(255,255,255,0.4)'}
          onMouseLeave={e=>e.currentTarget.style.color=focused?'rgba(212,84,26,0.7)':'rgba(255,255,255,0.12)'}>
          ◎
        </button>

        {/* Delete column */}
        <button onClick={()=>onDeleteColumn(column.id,colStickies.length)}
          style={{background:'none',border:'none',color:'rgba(255,255,255,0.12)',fontSize:'.75rem',padding:'0 2px',lineHeight:1,cursor:'none',transition:'color .15s',flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.style.color='#d4541a'}
          onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.12)'}>×</button>
      </div>

      {/* Stickies */}
      <div style={{flex:1,overflowY:'auto',padding:'.75rem',display:'flex',flexDirection:'column',gap:'.75rem'}}>
        <SortableContext items={filteredStickies.map(s=>s.id)} strategy={verticalListSortingStrategy}>
          {filteredStickies.map((s,i)=>(
            <StickyCard key={s.id} sticky={s} columnId={column.id} isIdle={isIdle}
              onDelete={onDeleteSticky} onUpdate={onUpdateSticky}
              inkMode={inkMode} focused={focused}
              colType={colType} positionInCol={i} totalInCol={filteredStickies.length}
              notes={notes} onOpenNote={onOpenNote} />
          ))}
        </SortableContext>
        {filteredStickies.length===0 && <ColumnDropZone columnId={column.id} />}
      </div>

      {/* Add sticky */}
      <button onClick={()=>onAddSticky(column.id)}
        style={{margin:'.4rem .75rem .75rem',padding:'.4rem',background:'transparent',border:'1px dashed rgba(212,84,26,0.2)',borderRadius:3,color:'rgba(212,84,26,0.5)',fontFamily:"var(--font-mono),monospace",fontSize:'.46rem',letterSpacing:'.1em',textTransform:'uppercase',transition:'all .2s',cursor:'none',flexShrink:0}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(212,84,26,0.45)';e.currentTarget.style.color='#d4541a'}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(212,84,26,0.2)';e.currentTarget.style.color='rgba(212,84,26,0.5)'}}>
        + Add Sticky
      </button>
    </div>
  )
}

// ── Board TopBar ──────────────────────────────────────────────────────────────
function BoardTopBar({ stickyCount, onSignOut, onSummary, onCluster, onPrep, inkMode, onInkToggle }) {
  const tbBtn = (active) => ({
    fontFamily:"var(--font-mono),monospace", fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase',
    background: active ? 'rgba(212,84,26,0.12)' : 'transparent',
    border: `1px solid ${active ? 'rgba(212,84,26,0.4)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius:4, padding:'.32rem .65rem', color: active ? '#d4541a' : 'rgba(240,236,228,0.35)',
    cursor:'none', transition:'all .2s', whiteSpace:'nowrap',
  })
  return (
    <div style={{height:52,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 1.25rem',borderBottom:'1px solid rgba(255,255,255,0.055)',background:'rgba(11,10,8,0.9)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',position:'relative',zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',gap:'.65rem'}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:'#d4541a',boxShadow:'0 0 10px rgba(212,84,26,0.5)',animation:'pulseSlow 3s ease-in-out infinite'}} />
        <span style={{fontFamily:"var(--font-prose),Georgia,serif",fontSize:'1.2rem',fontWeight:300,fontStyle:'italic',color:'rgba(240,236,228,0.9)'}}>
          The <em style={{color:'#d4541a'}}>Vault</em>
        </span>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
        {/* AI tools */}
        <button onClick={onSummary} style={tbBtn(false)}
          onMouseEnter={e=>{e.currentTarget.style.color='rgba(240,236,228,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,228,0.35)';e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}}>
          ✦ Summary
        </button>
        <button onClick={onCluster} style={tbBtn(false)}
          onMouseEnter={e=>{e.currentTarget.style.color='rgba(240,236,228,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,228,0.35)';e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}}>
          ◈ Cluster
        </button>
        <button onClick={onPrep} style={tbBtn(false)}
          onMouseEnter={e=>{e.currentTarget.style.color='rgba(240,236,228,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.18)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,228,0.35)';e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}}>
          📅 Prep
        </button>

        <div style={{width:1,height:16,background:'rgba(255,255,255,0.08)',margin:'0 .15rem'}} />

        {/* Ink toggle */}
        <button onClick={onInkToggle} style={tbBtn(inkMode)}
          onMouseEnter={e=>{e.currentTarget.style.color=inkMode?'#d4541a':'rgba(240,236,228,0.7)';e.currentTarget.style.borderColor=inkMode?'rgba(212,84,26,0.6)':'rgba(255,255,255,0.18)'}}
          onMouseLeave={e=>{e.currentTarget.style.color=inkMode?'#d4541a':'rgba(240,236,228,0.35)';e.currentTarget.style.borderColor=inkMode?'rgba(212,84,26,0.4)':'rgba(255,255,255,0.08)'}}>
          ✒ Ink
        </button>

        <div style={{width:1,height:16,background:'rgba(255,255,255,0.08)',margin:'0 .15rem'}} />

        <a href="/vault/dashboard"
          style={{fontFamily:"var(--font-mono),monospace",fontSize:'.5rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(240,236,228,0.3)',textDecoration:'none',padding:'.32rem .65rem',border:'1px solid rgba(255,255,255,0.055)',borderRadius:4,transition:'all .2s'}}
          onMouseEnter={e=>{e.currentTarget.style.color='rgba(240,236,228,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.14)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,228,0.3)';e.currentTarget.style.borderColor='rgba(255,255,255,0.055)'}}>
          Workspace
        </a>

        <div style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.32rem .65rem',border:'1px solid rgba(212,84,26,0.3)',borderRadius:4,background:'rgba(212,84,26,0.06)'}}>
          <span style={{fontFamily:"var(--font-mono),monospace",fontSize:'.5rem',letterSpacing:'.1em',textTransform:'uppercase',color:'#d4541a'}}>Board</span>
          {stickyCount>0&&<span style={{background:'#d4541a',color:'#0b0a08',borderRadius:3,padding:'0 .3rem',fontSize:'.44rem',fontWeight:700,lineHeight:'1.4'}}>{stickyCount}</span>}
        </div>

        <button onClick={onSignOut}
          style={{fontFamily:"var(--font-mono),monospace",fontSize:'.48rem',letterSpacing:'.1em',textTransform:'uppercase',color:'rgba(240,236,228,0.25)',background:'transparent',border:'1px solid rgba(255,255,255,0.055)',borderRadius:4,padding:'.32rem .65rem',cursor:'none',transition:'all .2s'}}
          onMouseEnter={e=>{e.currentTarget.style.color='rgba(240,236,228,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.14)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='rgba(240,236,228,0.25)';e.currentTarget.style.borderColor='rgba(255,255,255,0.055)'}}>
          Out
        </button>
      </div>
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

  const [user,       setUser]       = useState(null)
  const [columns,    setColumns]    = useState([])
  const [stickies,   setStickies]   = useState([])
  const [notes,      setNotes]      = useState([])    // for note link detection
  const [mounted,    setMounted]    = useState(false)
  const [loadError,  setLoadError]  = useState(null)
  const [activeItem, setActiveItem] = useState(null)
  const [isIdle,     setIsIdle]     = useState(false)
  // Smart board state
  const [inkMode,    setInkMode]    = useState(false)
  const [focusedCol, setFocusedCol] = useState(null)
  const [activeTags, setActiveTags] = useState(new Set())
  const [aiPanel,    setAiPanel]    = useState(null)  // { type:'summary'|'cluster'|'prep', text:'', loading:bool }
  const confettiColumnRef = useRef(null) // element to fire confetti from

  const idleRef = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint:{ distance:8 } }))

  // ── Idle ──
  function resetIdle() {
    setIsIdle(false)
    clearTimeout(idleRef.current)
    idleRef.current = setTimeout(()=>setIsIdle(true), 30000)
  }
  useEffect(() => {
    resetIdle()
    window.addEventListener('mousemove', resetIdle, { passive:true })
    window.addEventListener('keydown',   resetIdle, { passive:true })
    return () => {
      clearTimeout(idleRef.current)
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('keydown',   resetIdle)
    }
  }, []) // eslint-disable-line

  // ── Auth + load ──
  useEffect(() => {
    let active = true
    async function load() {
      const sb = getSupabase()
      const { data:{ session }, error:sessionError } = await sb.auth.getSession()
      if (!active) return
      if (sessionError || !session) { window.location.href = '/vault/login'; return }
      const uid = session.user.id
      setUser(session.user)
      try {
        const [colsRes, sticsRes, notesRes] = await Promise.all([
          sb.from('sticky_columns').select('*').eq('user_id', uid).order('position'),
          sb.from('stickies').select('*').eq('user_id', uid).order('position'),
          sb.from('notes').select('id, title').eq('user_id', uid),
        ])
        if (!active) return
        if (colsRes.error)  { console.error('sticky_columns:', colsRes.error);  setLoadError('Could not load columns: '+colsRes.error.message) }
        else setColumns(colsRes.data || [])
        if (sticsRes.error) { console.error('stickies:', sticsRes.error);       setLoadError(p=>p||'Could not load stickies: '+sticsRes.error.message) }
        else setStickies(sticsRes.data || [])
        if (notesRes.data)  setNotes(notesRes.data)
      } catch (err) {
        console.error('Board load error:', err)
        if (active) setLoadError(err?.message || 'Failed to load board')
      } finally {
        if (active) setMounted(true)
      }
    }
    load()
    return () => { active = false }
  }, []) // eslint-disable-line

  // ── Hotkey: S (quick capture) ──
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

  // ── All tags across all stickies (for filter bar) ──
  const allTags = [...new Set(stickies.flatMap(s => s.tags||[]))].sort()

  // ── CRUD ──
  async function handleAddColumn() {
    if (!user) return null
    const { data } = await getSupabase().from('sticky_columns')
      .insert({ user_id:user.id, name:'New Column', position:columns.length, type:'freeform' }).select().single()
    if (data) { setColumns(prev=>[...prev, data]); return data }
    return null
  }
  async function handleUpdateColumn(id, updates) {
    setColumns(prev=>prev.map(c=>c.id===id?{...c,...updates}:c))
    await updateColumn(getSupabase(), id, updates)
  }
  async function handleDeleteColumn(id, count) {
    if (count>0 && !window.confirm(`Delete column and its ${count} stickies?`)) return
    setColumns(prev=>prev.filter(c=>c.id!==id))
    setStickies(prev=>prev.filter(s=>s.column_id!==id))
    await deleteColumn(getSupabase(), id)
  }
  async function handleAddSticky(colId) {
    if (!user) return
    const rotation = parseFloat((Math.random()*6-3).toFixed(2))
    const position = stickies.filter(s=>s.column_id===colId).length
    const { data } = await getSupabase().from('stickies').insert({
      user_id:user.id, column_id:colId, content:'', color:'paper',
      rotation, position, source_type:'manual', tags:[], updated_at:new Date().toISOString(),
    }).select().single()
    if (data) setStickies(prev=>[...prev, data])
  }
  async function handleUpdateSticky(id, updates) {
    const withTs = { ...updates, updated_at: updates.updated_at || new Date().toISOString() }
    setStickies(prev=>prev.map(s=>s.id===id?{...s,...withTs}:s))
    await updateSticky(getSupabase(), id, withTs)
  }
  async function handleDeleteSticky(id) {
    setStickies(prev=>prev.filter(s=>s.id!==id))
    await deleteSticky(getSupabase(), id)
  }

  // ── Tag filter ──
  function toggleTag(tag) {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
  }

  // ── Focus mode ──
  function toggleFocus(colId) {
    setFocusedCol(prev => prev === colId ? null : colId)
  }

  // ── Open note (navigate to dashboard with note) ──
  function handleOpenNote(noteId) {
    if (noteId) window.location.href = `/vault/dashboard?note=${noteId}`
  }

  // ── AI helpers ──
  async function streamAI(model, messages, onChunk) {
    const res = await fetch(`${API_BASE}/api/chat/${model}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages, noteContext:null, publicNotes:[] }),
    })
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||`HTTP ${res.status}`) }
    const reader = res.body.getReader(), dec = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      text += dec.decode(value, { stream:true })
      onChunk(text)
    }
    return text
  }

  // ── Summary ──
  async function handleSummary() {
    if (!stickies.length) return
    const content = stickies.map(s=>s.content).filter(Boolean).join('\n')
    setAiPanel({ type:'summary', text:'', loading:true })
    try {
      await streamAI('claude', [
        { role:'user', content:`You are The Architect. The following are sticky notes from a thinking board. Give a concise one-paragraph synthesis of the key themes, decisions, and open questions.\n\nNotes:\n${content}` }
      ], t => setAiPanel(p=>({...p, text:t})))
    } catch (err) {
      setAiPanel(p=>({...p, text:`Error: ${err.message}`, loading:false}))
      return
    }
    setAiPanel(p=>({...p, loading:false}))
  }

  // ── Cluster ──
  async function handleCluster() {
    if (stickies.length < 2) return
    const indexed = stickies.map((s,i)=>`${i}: ${s.content||'(empty)'}`).join('\n')
    setAiPanel({ type:'cluster', text:'', loading:true })
    let fullText = ''
    try {
      fullText = await streamAI('gpt', [
        { role:'user', content:`You are The Spark. Group these sticky notes into 3-5 thematic clusters. Return ONLY valid JSON with this shape: {"clusters":[{"name":"string","indices":[0,1,2]}]}. No explanation, just JSON.\n\nNotes:\n${indexed}` }
      ], t => setAiPanel(p=>({...p, text:t})))
    } catch (err) {
      setAiPanel(p=>({...p, text:`Error: ${err.message}`, loading:false}))
      return
    }
    // Try to parse cluster JSON and offer column creation
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const { clusters } = JSON.parse(jsonMatch[0])
        if (Array.isArray(clusters)) {
          const names = clusters.map(c=>c.name).join(', ')
          setAiPanel(p=>({...p, loading:false, text:`Suggested clusters: ${names}\n\n${fullText}`}))
          return
        }
      }
    } catch {}
    setAiPanel(p=>({...p, loading:false}))
  }

  // ── Prep ──
  async function handlePrep() {
    const dated = stickies.filter(s => s.detected_date || detectDate(s.content||''))
    const content = dated.length
      ? dated.map(s=>s.content).filter(Boolean).join('\n')
      : stickies.slice(0,10).map(s=>s.content).filter(Boolean).join('\n')
    setAiPanel({ type:'prep', text:'', loading:true })
    try {
      await streamAI('claude', [
        { role:'user', content:`You are The Architect. Here are upcoming items from a thinking board. Give a brief, practical daily brief: what's on the plate, what needs a decision, what can wait.\n\nItems:\n${content}` }
      ], t => setAiPanel(p=>({...p, text:t})))
    } catch (err) {
      setAiPanel(p=>({...p, text:`Error: ${err.message}`, loading:false}))
      return
    }
    setAiPanel(p=>({...p, loading:false}))
  }

  // ── Pin AI response as sticky ──
  async function handlePinAI() {
    if (!aiPanel?.text || !user) return
    const firstCol = [...columns].sort((a,b)=>a.position-b.position)[0]
    let colId = firstCol?.id
    if (!colId) {
      const col = await handleAddColumn()
      colId = col?.id
    }
    if (!colId) return
    const { data } = await getSupabase().from('stickies').insert({
      user_id:user.id, column_id:colId,
      content: aiPanel.text.slice(0, 400),
      color:'charcoal', rotation:parseFloat((Math.random()*4-2).toFixed(2)),
      position:0, source_type:'manual', tags:[], updated_at:new Date().toISOString(),
    }).select().single()
    if (data) setStickies(prev=>[...prev, data])
    setAiPanel(null)
  }

  // ── DnD ──
  function onDragStart({ active }) {
    const t = active.data.current?.type
    setActiveItem(
      t==='sticky' ? { type:'sticky', data:active.data.current.sticky } :
      t==='column' ? { type:'column', data:active.data.current.column } : null
    )
  }
  function onDragOver({ active, over }) {
    if (!over || active.data.current?.type!=='sticky') return
    const s = active.data.current.sticky
    const overType = over.data.current?.type
    const targetColId = overType==='sticky' ? over.data.current.columnId
      : overType==='column-drop' ? over.data.current.columnId : null
    if (targetColId && targetColId!==s.column_id)
      setStickies(prev=>prev.map(x=>x.id===s.id?{...x,column_id:targetColId}:x))
  }
  function onDragEnd({ active, over }) {
    const prevItem = activeItem
    setActiveItem(null)
    if (!over) return
    const activeType = active.data.current?.type

    if (activeType==='column') {
      const oldIdx=columns.findIndex(c=>c.id===active.id)
      const newIdx=columns.findIndex(c=>c.id===over.id)
      if (oldIdx!==newIdx) {
        const reordered=arrayMove(columns,oldIdx,newIdx)
        setColumns(reordered)
        reordered.forEach((c,i)=>updateColumn(getSupabase(),c.id,{position:i}))
      }
      return
    }

    if (activeType==='sticky') {
      const movedSticky = stickies.find(x=>x.id===active.id)
      if (!movedSticky) return
      const overType = over.data.current?.type
      const targetColId = overType==='sticky' ? over.data.current.columnId
        : overType==='column-drop' ? over.data.current.columnId
        : movedSticky.column_id
      const targetCol = columns.find(c=>c.id===targetColId)

      // Confetti on drop into done column
      if (targetColId!==movedSticky.column_id && isDoneCol(targetCol?.name)) {
        fireConfetti(confettiColumnRef.current)
      }

      const colStickies = stickies.filter(x=>x.column_id===targetColId&&x.id!==active.id).sort((a,b)=>a.position-b.position)
      const overIdx = overType==='sticky' ? colStickies.findIndex(x=>x.id===over.id) : colStickies.length
      const inserted = [
        ...colStickies.slice(0,overIdx+1),
        {...movedSticky,column_id:targetColId},
        ...colStickies.slice(overIdx+1),
      ]
      setStickies(prev=>[...prev.filter(x=>x.column_id!==targetColId&&x.id!==active.id),...inserted])
      inserted.forEach((x,i)=>updateSticky(getSupabase(),x.id,{position:i,column_id:targetColId}))
    }
  }

  // ── Loading / error screen ──
  if (!mounted) return (
    <div style={{minHeight:'100vh',background:'#0b0a08',display:'flex',alignItems:'center',justifyContent:'center'}}>
      {loadError ? (
        <div style={{textAlign:'center',maxWidth:420,padding:'0 2rem'}}>
          <p style={{fontFamily:"var(--font-mono),monospace",fontSize:'.52rem',letterSpacing:'.14em',textTransform:'uppercase',color:'rgba(212,84,26,0.7)',marginBottom:'.75rem'}}>Board error</p>
          <p style={{fontFamily:"'Caveat',cursive",fontSize:'1.15rem',color:'rgba(240,236,228,0.45)',lineHeight:1.5}}>{loadError}</p>
        </div>
      ) : (
        <p style={{fontFamily:"var(--font-mono),monospace",fontSize:'.52rem',letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(240,236,228,0.2)'}}>Loading board…</p>
      )}
    </div>
  )

  const sortedColumns = [...columns].sort((a,b)=>a.position-b.position)
  const overlaySticky = activeItem?.type==='sticky' ? (stickies.find(s=>s.id===activeItem.data.id)||activeItem.data) : null
  const overlayColumn = activeItem?.type==='column' ? activeItem.data : null

  const panelTitles   = { summary:'The Architect — Board Summary', cluster:'The Spark — Cluster Suggestions', prep:'The Architect — Daily Prep' }
  const panelAvatars  = { summary:'◆', cluster:'◈', prep:'📅' }

  return (
    <div style={{height:'100vh',overflow:'hidden',display:'flex',flexDirection:'column',background:'#0b0a08',position:'relative',backgroundImage:['linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px)','linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px)','linear-gradient(rgba(255,255,255,.005) 1px,transparent 1px)','linear-gradient(90deg,rgba(255,255,255,.005) 1px,transparent 1px)'].join(','),backgroundSize:'100px 100px, 100px 100px, 20px 20px, 20px 20px'}}>

      {/* Ink mode SVG filter */}
      {inkMode && (
        <svg style={{position:'absolute',width:0,height:0,pointerEvents:'none'}}>
          <defs>
            <filter id="rough-paper">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
      )}

      {/* Confetti origin anchor (invisible, center of board area) */}
      <div ref={confettiColumnRef} style={{position:'absolute',top:'50%',left:'50%',width:1,height:1,pointerEvents:'none'}} />

      <BoardTopBar
        stickyCount={stickies.length}
        onSignOut={async()=>{await getSupabase().auth.signOut();window.location.href='/vault/login'}}
        onSummary={handleSummary}
        onCluster={handleCluster}
        onPrep={handlePrep}
        inkMode={inkMode}
        onInkToggle={()=>setInkMode(v=>!v)}
      />

      <TagFilterBar allTags={allTags} activeTags={activeTags} onToggle={toggleTag} onClear={()=>setActiveTags(new Set())} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div style={{flex:1,overflowX:'auto',overflowY:'hidden',display:'flex',alignItems:'flex-start',padding:'1.25rem',gap:'1rem'}}>
          <SortableContext items={sortedColumns.map(c=>c.id)} strategy={horizontalListSortingStrategy}>
            {sortedColumns.map(col => {
              const colStickies = stickies.filter(s=>s.column_id===col.id).sort((a,b)=>a.position-b.position)
              const isFocused   = focusedCol === col.id
              const isOtherFocus = focusedCol && focusedCol !== col.id
              return (
                <div key={col.id} style={{opacity: isOtherFocus ? 0.18 : 1, transition:'opacity .3s', flexShrink:0}}>
                  <BoardColumn
                    column={col} colStickies={colStickies} isIdle={isIdle}
                    onAddSticky={handleAddSticky}
                    onDeleteSticky={handleDeleteSticky}
                    onUpdateSticky={handleUpdateSticky}
                    onDeleteColumn={handleDeleteColumn}
                    onUpdateColumn={handleUpdateColumn}
                    inkMode={inkMode}
                    focused={isFocused}
                    onFocusToggle={()=>toggleFocus(col.id)}
                    activeTags={activeTags}
                    notes={notes}
                    onOpenNote={handleOpenNote}
                  />
                </div>
              )
            })}
          </SortableContext>

          {/* Add column button */}
          <button onClick={handleAddColumn}
            style={{flexShrink:0,width:240,minHeight:120,background:'transparent',border:'1px dashed rgba(255,255,255,0.06)',borderRadius:6,color:'rgba(255,255,255,0.18)',fontFamily:"var(--font-mono),monospace",fontSize:'.5rem',letterSpacing:'.14em',textTransform:'uppercase',cursor:'none',transition:'all .2s',alignSelf:'stretch',display:'flex',alignItems:'center',justifyContent:'center',gap:'.4rem'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(212,84,26,0.3)';e.currentTarget.style.color='rgba(212,84,26,0.6)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.06)';e.currentTarget.style.color='rgba(255,255,255,0.18)'}}>
            + Add Column
          </button>

          {/* Empty state */}
          {sortedColumns.length===0 && (
            <div style={{position:'absolute',inset:52,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
              <div style={{textAlign:'center'}}>
                <p style={{fontFamily:"'Caveat',cursive",fontSize:'2.2rem',color:'rgba(240,236,228,0.13)',fontStyle:'italic',lineHeight:1.5}}>Nothing here yet.</p>
                <p style={{fontFamily:"'Caveat',cursive",fontSize:'1.5rem',color:'rgba(240,236,228,0.1)',lineHeight:1.4,marginTop:'.25rem'}}>
                  Press <span style={{color:'rgba(212,84,26,0.45)',fontStyle:'normal'}}>S</span> to drop your first thought.
                </p>
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {overlaySticky && (
            <div style={{width:280,opacity:.9}}>
              <StickyCard sticky={overlaySticky} columnId={overlaySticky.column_id}
                isIdle={false} onDelete={()=>{}} onUpdate={()=>{}} isDragOverlay
                inkMode={inkMode} focused={false} colType="freeform" positionInCol={0} totalInCol={1}
                notes={notes} onOpenNote={()=>{}} />
            </div>
          )}
          {overlayColumn && (
            <div style={{width:280,height:200,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,opacity:.7}} />
          )}
        </DragOverlay>
      </DndContext>

      {/* AI Panel */}
      {aiPanel && (
        <AIPanel
          title={panelTitles[aiPanel.type]}
          avatar={panelAvatars[aiPanel.type]}
          loading={aiPanel.loading}
          text={aiPanel.text}
          onClose={()=>setAiPanel(null)}
          onPin={handlePinAI}
        />
      )}
      <TheGuideWidget />
    </div>
  )
}
