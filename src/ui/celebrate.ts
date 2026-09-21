export interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  shape: 'rect' | 'ribbon';
}

const COLORS = [
  '#FF6B35',
  '#22C55E',
  '#38BDF8',
  '#FBBF24',
  '#34D399',
  '#2DD4BF',
  '#F472B6',
  '#A78BFA',
];

/**
 * Spawn confetti particles across a viewport.
 *
 * Args:
 *   width: Canvas width in px.
 *   height: Canvas height in px.
 *   count: Particle count.
 * Returns:
 *   Particle array with velocity/gravity-ready state.
 */
export function spawnConfetti(width: number, height: number, count = 120): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const fromTop = Math.random() > 0.35;
    particles.push({
      x: Math.random() * width,
      y: fromTop ? -20 - Math.random() * height * 0.4 : Math.random() * height * 0.3,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 12,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      color: COLORS[i % COLORS.length],
      shape: Math.random() > 0.45 ? 'rect' : 'ribbon',
    });
  }
  return particles;
}

/**
 * Advance one animation frame (gravity + spin + wrap).
 *
 * Args:
 *   particles: Mutable particle list.
 *   width: Canvas width.
 *   height: Canvas height.
 * Returns:
 *   Particles (same reference).
 */
export function stepConfetti(particles: Particle[], width: number, height: number): Particle[] {
  for (const p of particles) {
    p.vy += 0.08;
    p.vx *= 0.99;
    p.x += p.vx + Math.sin(p.y * 0.02) * 0.6;
    p.y += p.vy;
    p.rot += p.vr;
    if (p.y > height + 30) {
      p.y = -20;
      p.x = Math.random() * width;
      p.vy = 2 + Math.random() * 4;
      p.vx = (Math.random() - 0.5) * 3;
    }
    if (p.x < -20) p.x = width + 10;
    if (p.x > width + 20) p.x = -10;
  }
  return particles;
}

/**
 * Draw particles onto a 2D context.
 *
 * Args:
 *   ctx: Canvas rendering context.
 *   particles: Particles to draw.
 */
export function drawConfetti(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.92;
    if (p.shape === 'ribbon') {
      ctx.fillRect(-p.w / 2, -1.5, p.w, 3);
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  }
}

/**
 * Play a short victory fanfare via Web Audio (no asset files).
 * Safe no-op when AudioContext is unavailable or muted.
 *
 * Args:
 *   muted: Skip playback when true.
 */
export function playVictoryFanfare(muted = false): void {
  if (muted) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // C5 – E5 – G5 – C6 – G5 – C6 (celebratory arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const durations = [0.12, 0.12, 0.12, 0.18, 0.12, 0.28];
    let t = now + 0.02;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + durations[i]);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + durations[i] + 0.05);
      t += durations[i] * 0.85;
    });
    window.setTimeout(() => {
      void ctx.close();
    }, 2500);
  } catch {
    // autoplay policies or missing audio — ignore
  }
}
