'use client'

// All faces are authored at this size, then CSS transform scales to the requested `size`.
const BASE = 56

// ── Architect ────────────────────────────────────────────────────────────────
function ArchFace({ state }) {
  return (
    <div className={`arch-base arch-${state}`} style={{ width: BASE, height: BASE }}>
      <div className="arch-grid" />
      <div className="arch-eyes">
        <div className="arch-eye"><div className="arch-iris" /></div>
        <div className="arch-eye"><div className="arch-iris" style={{ animationDelay: '-.3s' }} /></div>
      </div>
      <div className="arch-mouth" />
      {state === 'thinking' && (
        <div className="arch-thinking-dots"><span /><span /><span /></div>
      )}
      {state === 'speaking' && <div className="arch-speaking-flash" />}
    </div>
  )
}

// ── Spark ────────────────────────────────────────────────────────────────────
function SparkFace({ state }) {
  return (
    <div className={`spark-base spark-${state}`} style={{ width: BASE, height: BASE }}>
      <div className="spark-star-wrap">
        <div className="spark-star">✦</div>
        <div className="spark-star">✦</div>
        <div className="spark-star">✦</div>
      </div>
      <div className="spark-eyes-wrap">
        <div className="spark-eye" />
        <div className="spark-eye" />
      </div>
    </div>
  )
}

// ── Scribe — state-dependent terminal content ─────────────────────────────────
function ScribFace({ state }) {
  let gutterNums, lines
  if (state === 'thinking') {
    gutterNums = ['4','5','6']
    lines = [
      <div key="1" className="scrib-line"><span className="scrib-prompt" style={{ opacity: .2 }}>›</span>&nbsp;<span style={{ color: 'rgba(88,112,224,.3)', fontSize: '6px' }}>reading...</span></div>,
      <div key="2" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-cursor" /></div>,
      <div key="3" className="scrib-line scrib-think-dots" style={{ paddingLeft: 8 }}><span>.</span><span>.</span><span>.</span></div>,
    ]
  } else if (state === 'speaking') {
    gutterNums = ['7','8','9']
    lines = [
      <div key="1" className="scrib-line"><span className="scrib-prompt" style={{ opacity: .15 }}>›</span>&nbsp;<span style={{ color: 'rgba(88,112,224,.3)', fontSize: '6px' }}>done</span></div>,
      <div key="2" className="scrib-line scrib-output"><span className="scrib-prompt" style={{ opacity: .3 }}>›</span>&nbsp;<span style={{ color: 'rgba(88,112,224,.85)' }}>output ready</span></div>,
      <div key="3" className="scrib-line"><span className="scrib-prompt" style={{ opacity: .2 }}>›</span>&nbsp;<span className="scrib-cursor" style={{ opacity: 0 }} /></div>,
    ]
  } else if (state === 'reacting') {
    gutterNums = ['10','11','12']
    lines = [
      <div key="1" className="scrib-line"><span className="scrib-prompt" style={{ opacity: .2 }}>›</span></div>,
      <div key="2" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-cursor" /></div>,
      <div key="3" className="scrib-line"><span className="scrib-prompt" style={{ opacity: .15 }}>›</span></div>,
    ]
  } else if (state === 'agreeing') {
    gutterNums = ['13','14','15']
    lines = [
      <div key="1" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-output">build pass</span></div>,
      <div key="2" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-output">✓ ready</span></div>,
      <div key="3" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-cursor" /></div>,
    ]
  } else if (state === 'dissenting') {
    gutterNums = ['16','17','18']
    lines = [
      <div key="1" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-output">error</span></div>,
      <div key="2" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-output">✗ blocked</span></div>,
      <div key="3" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-cursor" /></div>,
    ]
  } else {
    // idle
    gutterNums = ['1','2','3']
    lines = [
      <div key="1" className="scrib-line"><span className="scrib-prompt" style={{ opacity: .2 }}>›</span></div>,
      <div key="2" className="scrib-line"><span className="scrib-prompt">›</span>&nbsp;<span className="scrib-cursor" /></div>,
      <div key="3" className="scrib-line" />,
    ]
  }

  return (
    <div className={`scrib-base scrib-${state}`} style={{ width: BASE, height: BASE }}>
      <div className="scrib-scanline" />
      <div className="scrib-status" />
      <div className="scrib-gutter">
        {gutterNums.map(n => <div key={n} className="scrib-ln">{n}</div>)}
      </div>
      <div className="scrib-terminal">{lines}</div>
    </div>
  )
}

// ── Steward ───────────────────────────────────────────────────────────────────
function StewFace({ state }) {
  return (
    <div className={`stew-base stew-${state}`} style={{ width: BASE, height: BASE }}>
      <svg className="stew-svg-wrap" width="46" height="46" viewBox="0 0 44 44">
        <circle cx="22" cy="15" r="6" fill="none" stroke="rgba(160,120,64,.4)" strokeWidth="1" />
        <circle cx="19.5" cy="14.5" r="1.2" fill="rgba(160,120,64,.7)" />
        <circle cx="24.5" cy="14.5" r="1.2" fill="rgba(160,120,64,.7)" />
        <g className="stew-beam" style={{ transformOrigin: '22px 21px' }}>
          <line x1="22" y1="21" x2="22" y2="32" stroke="rgba(160,120,64,.5)" strokeWidth="1.5" />
          <line x1="10" y1="25" x2="34" y2="25" stroke="rgba(160,120,64,.6)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="25" x2="10" y2="30" stroke="rgba(160,120,64,.4)" strokeWidth="1" />
          <line x1="7"  y1="30" x2="13" y2="30" stroke="rgba(160,120,64,.5)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="34" y1="25" x2="34" y2="30" stroke="rgba(160,120,64,.4)" strokeWidth="1" />
          <line x1="31" y1="30" x2="37" y2="30" stroke="rgba(160,120,64,.5)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}

// ── Advocate ──────────────────────────────────────────────────────────────────
function AdvFace({ state }) {
  const showHeart = state !== 'thinking' && state !== 'dissenting'
  return (
    <div className={`adv-base adv-${state}`} style={{ width: BASE, height: BASE }}>
      {state === 'speaking' && <div className="adv-speaking-glow" />}
      <div className="adv-eyes-wrap">
        <div className="adv-eye" />
        <div className="adv-eye" />
      </div>
      {showHeart && <div className="adv-heart">♥</div>}
    </div>
  )
}

// ── Contrarian ────────────────────────────────────────────────────────────────
function ConFace({ state }) {
  const showMark = state !== 'thinking'
  const markChar = (state === 'speaking' || state === 'dissenting') ? '!' : '?'
  return (
    <div className={`con-base con-${state}`} style={{ width: BASE, height: BASE }}>
      <div className="con-brow-l" />
      <div className="con-brow-r" />
      <div className="con-eyes-wrap">
        <div className="con-eye" />
        <div className="con-eye" />
      </div>
      {showMark && <div className="con-mark">{markChar}</div>}
    </div>
  )
}

// ── Socra ─────────────────────────────────────────────────────────────────────
function SocraFace({ state }) {
  return (
    <div className={`socra-base socra-${state}`} style={{ width: BASE, height: BASE }}>
      <div className="socra-rings-wrap">
        <div className="socra-ring socra-r5" />
        <div className="socra-ring socra-r4" />
        <div className="socra-ring socra-r3" />
        <div className="socra-ring socra-r2" />
        <div className="socra-ring socra-r1" />
        <div className="socra-core" />
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
const FACE_MAP = {
  arch:  ArchFace,
  spark: SparkFace,
  scrib: ScribFace,
  stew:  StewFace,
  adv:   AdvFace,
  con:   ConFace,
  socra: SocraFace,
}

export default function AgentFace({ agentId, state = 'idle', size = 34 }) {
  const FaceComponent = FACE_MAP[agentId]
  if (!FaceComponent) return null

  const scale = size / BASE
  const br = Math.round(12 * scale)

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: br, overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        width: BASE, height: BASE,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        position: 'absolute', top: 0, left: 0,
      }}>
        <FaceComponent state={state} />
      </div>
    </div>
  )
}
