'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0a0a0a' }}>
      {/* Ambient glow */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(212,84,26,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-sm animate-fade-up" style={{ animationFillMode: 'forwards' }}>
        {/* Logo */}
        <div className="text-center mb-12">
          <p className="panel-label mb-4" style={{ letterSpacing: '0.3em' }}>
            Restricted Access
          </p>
          <h1
            className="font-serif"
            style={{
              fontSize: 'clamp(3.5rem, 10vw, 6rem)',
              fontWeight: 300,
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            The{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--ember)' }}>Vault</em>
          </h1>
          <div
            style={{
              width: '40px',
              height: '1px',
              background: 'var(--ember)',
              opacity: 0.4,
              margin: '1.5rem auto 0',
            }}
          />
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                className="panel-label block mb-2"
                style={{ color: 'var(--muted)' }}
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="vault-input w-full px-4 py-3"
                style={{ fontSize: '0.9rem' }}
              />
            </div>

            {error && (
              <p
                className="font-mono text-xs"
                style={{ color: 'var(--ember)', letterSpacing: '0.05em' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="vault-btn w-full justify-center mt-2"
              style={{ padding: '1rem' }}
            >
              {loading ? (
                <span style={{ opacity: 0.6 }}>Sending&hellip;</span>
              ) : (
                <>Send Access Link <span style={{ fontSize: '0.9rem' }}>→</span></>
              )}
            </button>
          </form>
        ) : (
          <div
            className="vault-panel p-6 text-center"
            style={{ borderColor: 'var(--ember-dim)' }}
          >
            <div
              className="online-dot mx-auto mb-4"
              style={{ width: '8px', height: '8px' }}
            />
            <p className="panel-label mb-2" style={{ color: 'var(--ember)' }}>
              Link Sent
            </p>
            <p
              className="font-serif"
              style={{ color: 'var(--mid)', fontSize: '0.95rem', fontWeight: 300, lineHeight: 1.7 }}
            >
              Check your inbox. The link expires in 10 minutes.
            </p>
            <button
              onClick={() => setSent(false)}
              className="vault-btn-ghost mt-6"
            >
              Try a different email
            </button>
          </div>
        )}

        <p
          className="text-center mt-8 font-mono"
          style={{ fontSize: '0.5rem', letterSpacing: '0.2em', color: 'var(--muted)', opacity: 0.5, textTransform: 'uppercase' }}
        >
          Trusted team only
        </p>
      </div>
    </div>
  )
}
