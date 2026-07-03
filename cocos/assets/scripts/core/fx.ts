/* fx.ts — 特效池（纯数据+更新；绘制在视图层 Painter 里读取这些数组）。 */
import { rand, clamp } from './config';

export interface Particle { x: number, y: number, vx: number, vy: number, life: number, color: string, r: number }
export interface Beam { x1: number, y1: number, x2: number, y2: number, life: number, c: string }
export interface Float { x: number, y: number, t: string, life: number, color: string, sz: number }

let _particles: Particle[] = [], _beams: Beam[] = [], _floats: Float[] = [], _shake = 0;

export const fx = {
  get particles() { return _particles; },
  get beams() { return _beams; },
  get floats() { return _floats; },

  burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) { const a = rand(0, 7), s = rand(1, 5); _particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, r: rand(2, 4) }); }
  },
  addBeam(b: Beam): void { _beams.push(b); },
  addFloat(f: Float): void { _floats.push(f); },
  addShake(v: number): void { _shake = Math.min(_shake + v, 10); },
  setShake(v: number): void { _shake = v; },
  shakeOffset(): { sx: number, sy: number } {
    if (_shake > 0.2) { const sx = rand(-_shake, _shake), sy = rand(-_shake, _shake); _shake *= 0.85; return { sx, sy }; }
    _shake = 0; return { sx: 0, sy: 0 };
  },
  update(dt: number): void {
    for (const p of _particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt * 1.6; }
    _particles = _particles.filter(p => p.life > 0);
    for (const b of _beams) b.life -= dt * 2.2; _beams = _beams.filter(b => b.life > 0);
    for (const f of _floats) { f.y -= 14 * dt; f.life -= dt * 0.9; } _floats = _floats.filter(f => f.life > 0);
  },
  clear(): void { _particles = []; _beams = []; _floats = []; _shake = 0; }
};
export { clamp };
