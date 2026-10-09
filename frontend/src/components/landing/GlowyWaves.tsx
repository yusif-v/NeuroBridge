import { useEffect, useRef } from 'react'

type Rgb = [number, number, number]

const CYAN: Rgb = [0, 229, 255] // #00E5FF
const VIOLET: Rgb = [139, 92, 246] // #8B5CF6

/** A ribbon of near-parallel lines that share one motion, drawn with a soft glow pass. */
interface Bundle {
  y: number // baseline, fraction of height
  lines: number
  spread: number // px between lines at rest
  amp: number // px
  freq: number // radians per px
  speed: number // radians per second
  phase: number
  alpha: number
  from: Rgb
  to: Rgb
}

const BUNDLES: Bundle[] = [
  { y: 0.6, lines: 10, spread: 7, amp: 80, freq: 0.0032, speed: 0.35, phase: 0, alpha: 0.85, from: CYAN, to: VIOLET },
  { y: 0.68, lines: 8, spread: 9, amp: 105, freq: 0.0021, speed: -0.22, phase: 2.1, alpha: 0.65, from: VIOLET, to: CYAN },
  { y: 0.5, lines: 6, spread: 6, amp: 60, freq: 0.0045, speed: 0.5, phase: 4.2, alpha: 0.45, from: CYAN, to: VIOLET },
  { y: 0.3, lines: 5, spread: 10, amp: 70, freq: 0.0018, speed: -0.18, phase: 5.1, alpha: 0.3, from: VIOLET, to: CYAN },
  { y: 0.8, lines: 6, spread: 12, amp: 120, freq: 0.0015, speed: 0.15, phase: 1.3, alpha: 0.4, from: VIOLET, to: VIOLET },
]

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`

/**
 * Full-bleed animated wave lines (canvas). Purely decorative: aria-hidden, no pointer events.
 * Reacts to the pointer anywhere over its parent, pauses offscreen, renders one still frame
 * when the user prefers reduced motion, and releases everything on unmount.
 */
export function GlowyWaves({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarse = window.matchMedia('(pointer: coarse)').matches
    let width = 0
    let height = 0
    let raf = 0
    let visible = true
    let last = performance.now()
    let t = 0

    // Pointer, normalised to the canvas (0..1). `target` is raw, `pointer` is eased toward it.
    const target = { x: 0.5, y: 0.5, active: 0 }
    const pointer = { x: 0.5, y: 0.5, active: 0 }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduceMotion.matches) draw()
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'
      const step = width < 640 ? 14 : 8
      const scale = Math.min(1, Math.max(0.55, width / 1440))
      const sigma = width * 0.18
      const mx = pointer.x * width
      const my = pointer.y * height

      for (const b of BUNDLES) {
        const base = b.y * height
        const amp = b.amp * scale
        const lines = width < 640 ? Math.ceil(b.lines * 0.6) : b.lines

        const grad = ctx.createLinearGradient(0, 0, width, 0)
        grad.addColorStop(0, rgba(b.from, 0))
        grad.addColorStop(0.2, rgba(b.from, 1))
        grad.addColorStop(0.8, rgba(b.to, 1))
        grad.addColorStop(1, rgba(b.to, 0))

        const path = (offset: number) => {
          ctx.beginPath()
          for (let x = -step; x <= width + step; x += step) {
            // Gaussian falloff around the pointer: lines lean toward it and swell slightly.
            const near = Math.exp(-((x - mx) ** 2) / (2 * sigma * sigma)) * pointer.active
            const y = base
              + Math.sin(x * b.freq + t * b.speed + b.phase + offset * 0.05) * amp * (1 + near * 0.35)
              + Math.sin(x * b.freq * 2.3 - t * b.speed * 0.6 + b.phase) * amp * 0.18
              + (my - base) * near * 0.22
              + offset * (1 + near * 0.6)
            if (x === -step) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
        }

        ctx.strokeStyle = grad
        const mid = (lines - 1) / 2

        // Glow pass: one wide, faint stroke along the ribbon's centre.
        ctx.globalAlpha = b.alpha * 0.22
        ctx.lineWidth = b.spread * lines * 1.1
        path(0)
        ctx.stroke()

        // Crisp lines, brightest in the middle of the ribbon.
        ctx.lineWidth = 1.3
        for (let i = 0; i < lines; i++) {
          const o = (i - mid) * b.spread
          ctx.globalAlpha = b.alpha * (1 - Math.abs(i - mid) / (mid + 1)) * 0.9
          path(o)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      const ease = 1 - Math.exp(-dt * 4)
      pointer.x += (target.x - pointer.x) * ease
      pointer.y += (target.y - pointer.y) * ease
      pointer.active += (target.active - pointer.active) * ease
      draw()
      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (raf || reduceMotion.matches || !visible) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }

    const host = canvas.parentElement ?? canvas
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      target.x = (e.clientX - rect.left) / rect.width
      target.y = (e.clientY - rect.top) / rect.height
      target.active = 1
    }
    const onLeave = () => { target.active = 0 }
    const onMotionPref = () => {
      if (reduceMotion.matches) { stop(); draw() } else start()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(canvas)
    if (!coarse) {
      host.addEventListener('pointermove', onMove, { passive: true })
      host.addEventListener('pointerleave', onLeave, { passive: true })
    }
    reduceMotion.addEventListener('change', onMotionPref)

    resize()
    draw()
    start()

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      reduceMotion.removeEventListener('change', onMotionPref)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />
}
