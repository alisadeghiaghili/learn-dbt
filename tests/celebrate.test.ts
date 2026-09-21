import { describe, expect, it } from 'vitest';
import { spawnConfetti, stepConfetti } from '../src/ui/celebrate';

describe('celebration confetti', () => {
  it('spawns particles across the canvas', () => {
    const p = spawnConfetti(800, 600, 50);
    expect(p).toHaveLength(50);
    expect(p.every((x) => x.x >= 0 && x.x <= 800)).toBe(true);
  });

  it('advances particles downward with gravity', () => {
    const p = spawnConfetti(400, 400, 10);
    const y0 = p.map((x) => x.y);
    stepConfetti(p, 400, 400);
    const moved = p.some((x, i) => x.y > y0[i]);
    expect(moved).toBe(true);
  });
});
