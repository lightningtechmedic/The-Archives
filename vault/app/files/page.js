'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

function formatBytes(b) {
  if (!b) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const EXT_ICONS = {
  pdf: { icon: '📄', color: '#ff6060' },
  png: { icon: '🖼', color: '#60c0ff' },
  jpg: { icon: '🖼', color: '#60c0ff' },
  jpeg: { icon: '🖼', color: '#60c0ff' },
  gif: { icon: '🖼', color: '#60c0ff' },
  webp: { icon: '🖼', color: '#60c0ff' },
  mp4: { icon: '🎬', color: '#c060ff' },
  mov: { icon: '🎬', color: '#c060ff' },
  doc: { icon: '📝', color: '#60a0ff' },
  docx: { icon: '📝', color: '#60a0ff' },
  xls: { icon: '📊', color: '#60c890' },
  xlsx: { icon: '📊', color: '#60c890' },
  zip: { icon: '🗜', color: '#ffc060' },
  default: { icon: '📁', color: 'var(--muted)' },
}

function getExtMeta(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || ''
  return EXT_ICONS[ext] || { ...EXT_ICONS.default, label: ext.toUpperCase().slice(0, 4) || 'FILE' }
}

function FileCard({ file, onToggleShare, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const meta = getExtMeta(file.file_name)
  return (
    <div className="file-card" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Type badge */}
      <div className="file-type-badge">
        <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:'.4rem', letterSpacing:'.06em', textTransform:'uppercase', color: meta.color }}>
          {(file.file_name.split('.').pop() || '').toUpperCase().slice(0, 4)}
        </span>
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <a href={file.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
          <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.1rem', color: hovered ? 'var(--ember)' : 'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', transition:'color .15s', marginBottom:'.15rem' }}>
            {file.file_name}
          </p>
        </a>
        <div style={{ display:'flex', gap:'.8rem', alignItems:'center' }}>
          <span className="msg-timestamp">{formatBytes(file.file_size)}</span>
          <span className="msg-timestamp">{formatDate(file.created_at)}</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'.42rem', letterSpacing:'.08em', textTransform:'uppercase', color: file.is_shared ? 'var(--cyan)' : 'var(--muted)' }}>
            {file.is_shared ? '◆ shared' : '◇ private'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:'.4rem', opacity: hovered ? 1 : 0, transition:'opacity .2s', flexShrink:0 }}>
        <a href={file.file_url} download target="_blank" rel="noopener noreferrer"
          style={{ padding:'.3rem .6rem', border:'1px solid var(--border)', borderRadius:'2px', background:'transparent', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', textDecoration:'none', transition:'all .15s', display:'inline-flex', alignItems:'center' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-h)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
          ↓
        </a>
        <button onClick={onToggleShare}
          style={{ padding:'.3rem .6rem', border:`1px solid ${file.is_shared ? 'var(--cyan)' : 'var(--border)'}`, borderRadius:'2px', background: file.is_shared ? 'var(--cyan-dim)' : 'transparent', color: file.is_shared ? 'var(--cyan)' : 'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s' }}>
          {file.is_shared ? 'Shared' : 'Share'}
        </button>
        <button onClick={onDelete}
          style={{ padding:'.3rem .6rem', border:'1px solid rgba(212,84,26,0.2)', borderRadius:'2px', background:'transparent', color:'rgba(212,84,26,0.45)', fontFamily:'var(--font-mono)', fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', transition:'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ember)'; e.currentTarget.style.borderColor = 'var(--ember)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(212,84,26,0.45)'; e.currentTarget.style.borderColor = 'rgba(212,84,26,0.2)' }}>
          Delete
        </button>
      </div>
    </div>
  )
}

export default function FilesPage() {
  const supabaseRef = useRef(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const [user, setUser] = useState(null)
  const [files, setFiles] = useState([])
  const [sharedFiles, setSharedFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (!session) { window.location.href = '/vault/login'; return }
      setUser(session.user); setMounted(true); loadFiles(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  async function loadFiles(uid) {
    const id = uid || user?.id
    if (!id) return
    const sb = getSupabase()
    const [{ data: own }, { data: shared }] = await Promise.all([
      sb.from('files').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      sb.from('files').select('*').eq('is_shared', true).neq('user_id', id).order('created_at', { ascending: false }),
    ])
    setFiles(own || [])
    setSharedFiles(shared || [])
  }

  async function uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    const sb = getSupabase()
    for (const file of Array.from(fileList)) {
      setUploadMsg(`Uploading ${file.name}…`)
      const path = `${user.id}/${Date.now()}-${file.name}`
      const { error } = await sb.storage.from('vault-files').upload(path, file)
      if (error) { console.error('Upload error:', error); continue }
      const { data: urlData } = sb.storage.from('vault-files').getPublicUrl(path)
      await sb.from('files').insert({ user_id: user.id, file_name: file.name, file_url: urlData.publicUrl, file_size: file.size, mime_type: file.type, is_shared: false })
    }
    setUploadMsg(''); setUploading(false); loadFiles()
  }

  async function toggleShare(file) {
    const { data } = await getSupabase().from('files').update({ is_shared: !file.is_shared }).eq('id', file.id).select().single()
    if (data) setFiles(prev => prev.map(f => f.id === data.id ? data : f))
  }

  async function deleteFile(file) {
    const parts = file.file_url.split('/vault-files/')
    if (parts[1]) await getSupabase().storage.from('vault-files').remove([parts[1]])
    await getSupabase().from('files').delete().eq('id', file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  if (!mounted) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p className="panel-label animate-pulse-slow">Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      {/* Topbar */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:44, zIndex:500, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem', background:'rgba(11,10,8,0.88)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
          <div className="ember-pip" />
          <a href="/vault/dashboard" style={{ fontFamily:'var(--font-serif)', fontSize:'1.1rem', fontWeight:300, fontStyle:'italic', color:'var(--text)', textDecoration:'none' }}>
            The <em style={{ color:'var(--ember)' }}>Vault</em>
          </a>
          <span style={{ color:'var(--border)' }}>|</span>
          <span className="panel-label">Files</span>
        </div>
        <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
          <button className="vault-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ padding:'.45rem .9rem', fontSize:'.55rem' }}>
            {uploading ? uploadMsg || 'Uploading…' : '+ Upload'}
          </button>
          <input ref={fileInputRef} type="file" multiple style={{ display:'none' }} onChange={e => uploadFiles(e.target.files)} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, paddingTop:44, display:'flex' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            data-hover
            style={{ margin:'1.5rem', border:`2px dashed ${dragging ? 'var(--ember)' : 'rgba(255,255,255,0.1)'}`, borderRadius:'4px', padding:'3rem 2rem', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'.75rem', background: dragging ? 'var(--ember-glow)' : 'rgba(255,255,255,0.008)', transition:'all .25s var(--ease)', cursor:'none', flexShrink:0 }}
          >
            {uploading ? (
              <>
                <div className="animate-pulse-slow" style={{ fontSize:'2rem' }}>⬆</div>
                <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.4rem', color:'var(--ember)' }}>{uploadMsg || 'Uploading…'}</p>
              </>
            ) : (
              <>
                <div style={{ fontSize:'2.5rem', opacity: dragging ? 1 : .35, color: dragging ? 'var(--ember)' : 'var(--muted)', transition:'all .2s' }}>
                  {dragging ? '✦' : '⬆'}
                </div>
                <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.5rem', color: dragging ? 'var(--ember)' : 'var(--muted)', transition:'color .2s' }}>
                  {dragging ? 'drop it.' : 'drop files here'}
                </p>
                <p style={{ fontFamily:'var(--font-mono)', fontSize:'.48rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--muted)', opacity:.6 }}>
                  or click to browse · any file type
                </p>
              </>
            )}
          </div>

          {/* Files */}
          <div style={{ flex:1, overflowY:'auto', padding:'0 1.5rem 2rem' }}>
            {files.length === 0 ? (
              <div style={{ textAlign:'center', paddingTop:'3rem', opacity:.3 }}>
                <p style={{ fontFamily:'var(--font-caveat)', fontSize:'1.8rem', color:'var(--muted)', fontStyle:'italic' }}>No files yet.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                {files.map(file => (
                  <FileCard key={file.id} file={file} onToggleShare={() => toggleShare(file)} onDelete={() => deleteFile(file)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shared sidebar */}
        {sharedFiles.length > 0 && (
          <div style={{ width:260, flexShrink:0, borderLeft:'1px solid var(--border)', overflowY:'auto', padding:'1rem .75rem' }}>
            <p className="panel-label" style={{ marginBottom:'.75rem' }}>Shared by team</p>
            {sharedFiles.map(file => {
              const meta = getExtMeta(file.file_name)
              return (
                <a key={file.id} href={file.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'block' }}>
                  <div style={{ padding:'.6rem 0', borderBottom:'1px solid var(--border)', display:'flex', gap:'.6rem', alignItems:'center', transition:'opacity .15s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '.75'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                    <span style={{ fontSize:'1rem' }}>{meta.icon}</span>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontFamily:'var(--font-caveat)', fontSize:'.95rem', color:'var(--mid)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.file_name}</p>
                      <div style={{ display:'flex', gap:'.5rem' }}>
                        <span className="msg-timestamp">{formatBytes(file.file_size)}</span>
                        <span className="msg-timestamp">{formatDate(file.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
