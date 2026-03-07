'use client'

export default function Error({ error, reset }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: '0.65rem',
        letterSpacing: '0.15em',
        gap: '1.5rem',
      }}
    >
      <span style={{ color: '#d4541a', letterSpacing: '0.2em' }}>ERROR</span>
      <span style={{ opacity: 0.5 }}>{error?.message || 'Something went wrong.'}</span>
      <button
        onClick={reset}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          letterSpacing: 'inherit',
          padding: '0.6rem 1.2rem',
          cursor: 'pointer',
        }}
      >
        TRY AGAIN
      </button>
    </div>
  )
}
