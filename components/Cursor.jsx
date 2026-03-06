'use client'

import { useEffect, useRef } from 'react'

export default function Cursor() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const pos = useRef({ mx: 0, my: 0, rx: 0, ry: 0 })
  const raf = useRef(null)

  useEffect(() => {
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    const onMove = (e) => {
      pos.current.mx = e.clientX
      pos.current.my = e.clientY
      dot.style.left = e.clientX + 'px'
      dot.style.top = e.clientY + 'px'
    }

    const animate = () => {
      const p = pos.current
      p.rx += (p.mx - p.rx) * 0.1
      p.ry += (p.my - p.ry) * 0.1
      ring.style.left = p.rx + 'px'
      ring.style.top = p.ry + 'px'
      raf.current = requestAnimationFrame(animate)
    }

    const onEnter = () => document.body.classList.add('cursor-hover')
    const onLeave = () => document.body.classList.remove('cursor-hover')

    document.addEventListener('mousemove', onMove)
    raf.current = requestAnimationFrame(animate)

    const addHover = () => {
      document.querySelectorAll('a, button, [data-hover]').forEach(el => {
        el.addEventListener('mouseenter', onEnter)
        el.addEventListener('mouseleave', onLeave)
      })
    }

    addHover()
    const observer = new MutationObserver(addHover)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf.current)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
