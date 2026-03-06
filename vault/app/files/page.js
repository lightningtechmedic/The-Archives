'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export default function FilesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [files, setFiles] = useState([])
  const [sharedFiles, setSharedFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setMounted(true)
      loadFiles(session.user.id)
    })
  }, []) // eslint-disable-line

  async function loadFiles(uid) {
    const userId = uid || user?.id
    if (!userId) return

    const { data: own } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setFiles(own || [])

    const { data: shared } = await supabase
      .from('files')
      .select('*')
      .eq('is_shared', true)
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
    setSharedFiles(shared || [])
  }

  async function uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)

    for (const file of Array.from(fileList)) {
      setUploadProgress(`Uploading ${file.name}…`)
      const path = `${user.id}/${Date.now()}-${file.name}`

      const { data: storageData, error: storageErr } = await supabase.storage
        .from('vault-files')
        .upload(path, file)

      if (storageErr) {
        console.error('Upload error:', storageErr)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('vault-files')
        .getPublicUrl(path)

      await supabase.from('files').insert({
        user_id: user.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        is_shared: false,
      })
    }

    setUploadProgress(null)
    setUploading(false)
    loadFiles()
  }

  async function toggleShare(file) {
    const { data } = await supabase
      .from('files')
      .update({ is_shared: !file.is_shared })
      .eq('id', file.id)
      .select()
      .single()
    if (data) {
      setFiles(prev => prev.map(f => f.id === data.id ? data : f))
    }
  }

  async function deleteFile(file) {
    // Extract path from URL
    const urlParts = file.file_url.split('/vault-files/')
    if (urlParts[1]) {
      await supabase.storage.from('vault-files').remove([urlParts[1]])
    }
    await supabase.from('files').delete().eq('id', file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    uploadFiles(e.dataTransfer.files)
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="panel-label animate-pulse-slow">Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div
        style={{
          height: '48px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.25rem',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.01)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href="/dashboard"
            className="font-mono"
            style={{ fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', textDecoration: 'none' }}
          >
            ← Vault
          </Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="panel-label">Files</span>
        </div>
        <button
          className="vault-btn"
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '0.5rem 1rem' }}
          disabled={uploading}
        >
          + Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => uploadFiles(e.target.files)}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            data-hover
            style={{
              margin: '1.5rem',
              border: `1px dashed ${dragging ? 'var(--ember)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '2px',
              padding: '2.5rem',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              background: dragging ? 'var(--ember-glow)' : 'rgba(255,255,255,0.01)',
              transition: 'all 0.2s',
              cursor: 'none',
              flexShrink: 0,
            }}
          >
            <div style={{ color: dragging ? 'var(--ember)' : 'var(--muted)', transition: 'color 0.2s' }}>
              <UploadIcon />
            </div>
            {uploading ? (
              <p className="panel-label" style={{ color: 'var(--ember)' }}>
                {uploadProgress || 'Uploading…'}
              </p>
            ) : (
              <>
                <p className="panel-label" style={{ color: dragging ? 'var(--ember)' : 'var(--muted)' }}>
                  Drop files here or click to upload
                </p>
                <p className="font-mono" style={{ fontSize: '0.5rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Any file type · No size limit
                </p>
              </>
            )}
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: '3rem', opacity: 0.3 }}>
                <p className="font-serif" style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--muted)' }}>No files yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>
                {files.map(file => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onToggleShare={() => toggleShare(file)}
                    onDelete={() => deleteFile(file)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shared sidebar */}
        {sharedFiles.length > 0 && (
          <div
            className="vault-panel"
            style={{ width: '280px', flexShrink: 0, overflowY: 'auto', borderLeft: '1px solid var(--border)' }}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: '#0a0a0a' }}>
              <span className="panel-label">Shared by Team</span>
            </div>
            <div style={{ padding: '0.5rem' }}>
              {sharedFiles.map(file => (
                <a
                  key={file.id}
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div
                    style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text)', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.file_name}
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <span className="msg-timestamp">{formatBytes(file.file_size)}</span>
                      <span className="msg-timestamp">{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FileRow({ file, onToggleShare, onDelete }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.75rem 1rem',
        background: hovered ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.01)',
        transition: 'background 0.15s',
      }}
    >
      {/* File icon */}
      <div
        style={{
          width: 32, height: 32, flexShrink: 0,
          border: '1px solid var(--border)', borderRadius: '2px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: '0.45rem',
          color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase',
        }}
      >
        {file.file_name.split('.').pop()?.slice(0, 4) || 'FILE'}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={file.file_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <p
            className="font-mono"
            style={{
              fontSize: '0.68rem', color: 'var(--text)', letterSpacing: '0.02em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ember)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text)'}
          >
            {file.file_name}
          </p>
        </a>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
          <span className="msg-timestamp">{formatBytes(file.file_size)}</span>
          <span className="msg-timestamp">{formatDate(file.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', flexShrink: 0 }}>
        <button
          onClick={onToggleShare}
          style={{
            padding: '0.3rem 0.6rem',
            fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            border: `1px solid ${file.is_shared ? '#50c864' : 'var(--border)'}`,
            borderRadius: '2px',
            background: file.is_shared ? 'rgba(80,200,100,0.08)' : 'transparent',
            color: file.is_shared ? '#50c864' : 'var(--muted)',
            transition: 'all 0.15s',
          }}
        >
          {file.is_shared ? 'Shared' : 'Share'}
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: '0.3rem 0.6rem',
            fontFamily: 'var(--font-mono)', fontSize: '0.5rem',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            border: '1px solid rgba(212,84,26,0.2)',
            borderRadius: '2px',
            background: 'transparent',
            color: 'rgba(212,84,26,0.5)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--ember)'; e.currentTarget.style.borderColor = 'var(--ember)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(212,84,26,0.5)'; e.currentTarget.style.borderColor = 'rgba(212,84,26,0.2)' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
