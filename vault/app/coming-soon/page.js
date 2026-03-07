'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ComingSoonInner() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'

  const [value, setValue] = useState('')
  const [shaking, setShaking] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const [placeholder, setPlaceholder] = useState('password')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function attempt() {
    const pw = process.env.NEXT_PUBLIC_SITE_PASSWORD
    if (!pw) return // env not set — don't lock everyone out

    if (value === pw) {
      // Correct — flash, set cookie, redirect
      setFlashing(true)
      const expires = new Date()
      expires.setDate(expires.getDate() + 30)
      document.cookie = `carbon_access=${encodeURIComponent(value)}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
      setTimeout(() => {
        // Only allow relative paths to prevent open redirect
        const dest = from.startsWith('/') ? from : '/'
        window.location.href = dest
      }, 380)
    } else {
      // Wrong — shake and reset
      setValue('')
      setPlaceholder('incorrect — try again')
      setShaking(true)
      setTimeout(() => {
        setShaking(false)
        setPlaceholder('password')
        inputRef.current?.focus()
      }, 600)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') attempt()
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'var(--font-mono), monospace',
      transition: 'opacity .3s',
      opacity: flashing ? 0 : 1,
    }}>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-8px); }
          30%      { transform: translateX(7px); }
          45%      { transform: translateX(-6px); }
          60%      { transform: translateX(5px); }
          75%      { transform: translateX(-3px); }
          90%      { transform: translateX(2px); }
        }
        .shake { animation: shake 0.55s cubic-bezier(.36,.07,.19,.97) both; }

        input::placeholder { color: rgba(255,255,255,0.22); }
        input:focus { outline: none; border-color: rgba(255,255,255,0.28) !important; }
      `}</style>

      {/* Logo mark */}
      <div style={{
        width: 10, height: 10,
        borderRadius: '50%',
        background: '#d4541a',
        marginBottom: '2.5rem',
        boxShadow: '0 0 18px rgba(212,84,26,0.5)',
      }} />

      {/* Carbon OS */}
      <p style={{
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 'clamp(.6rem, 2vw, .75rem)',
        letterSpacing: '.38em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
        margin: 0,
        marginBottom: '.9rem',
      }}>
        Carbon OS
      </p>

      {/* Coming Soon */}
      <h1 style={{
        fontFamily: 'var(--font-serif), Lora, Georgia, serif',
        fontWeight: 400,
        fontStyle: 'italic',
        fontSize: 'clamp(2rem, 6vw, 3.2rem)',
        color: 'rgba(255,255,255,0.88)',
        margin: 0,
        marginBottom: '3.5rem',
        letterSpacing: '-.01em',
        lineHeight: 1,
      }}>
        Coming Soon
      </h1>

      {/* Password field */}
      <div className={shaking ? 'shake' : ''} style={{ width: '100%', maxWidth: 280 }}>
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 0,
            padding: '.6rem 0',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '.72rem',
            letterSpacing: '.12em',
            color: 'rgba(255,255,255,0.88)',
            textAlign: 'center',
            transition: 'border-color .2s',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={attempt}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '1.5rem',
            padding: '.55rem 0',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '2px',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '.58rem',
            letterSpacing: '.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.38)',
            cursor: 'pointer',
            transition: 'border-color .2s, color .2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.38)'
          }}
        >
          Enter
        </button>
      </div>
    </div>
  )
}

export default function ComingSoon() {
  return (
    <Suspense>
      <ComingSoonInner />
    </Suspense>
  )
}
