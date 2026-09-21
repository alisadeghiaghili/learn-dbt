import { useEffect, useRef } from 'react';
import { drawConfetti, spawnConfetti, stepConfetti } from './celebrate';

interface Props {
  active: boolean;
  /** Burst length in ms before particles keep drifting. */
  durationMs?: number;
}

/**
 * Full-viewport confetti canvas used on level solve.
 *
 * Args:
 *   active: Mount/animation when true.
 *   durationMs: How long the dense burst lasts.
 * Returns:
 *   Fixed-position canvas element.
 */
export function ConfettiCanvas({ active, durationMs = 4500 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particles = spawnConfetti(width, height, reduce ? 40 : 160);
    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);
      // denser burst early, then thin out
      const visible =
        elapsed < durationMs
          ? particles
          : particles.filter((_, i) => i % 3 === 0);
      stepConfetti(visible, width, height);
      drawConfetti(ctx, visible);
      if (elapsed < durationMs + 2500) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  if (!active) return null;
  return (
    <div className="confetti-layer" aria-hidden="true">
      <canvas ref={ref} className="confetti-canvas" />
    </div>
  );
}
