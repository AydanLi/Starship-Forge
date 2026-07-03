/* board.ts — 编队：阵位/拖拽/升星（与 js/board.js 一致）。 */
import { C } from './config';
import { G, setHint, flashHint } from './state';
import { forge } from './forge';
import { fx } from './fx';
import { audio } from './audio';

let uiDirty = () => {};
export function bindUiDirty(f: () => void) { uiDirty = f; }

function tokenAt(px: number, py: number): { tok: any, fromSlot: number | null } | null {
  for (let i = 0; i < 6; i++) { const t = G.slots[i]; if (t && Math.hypot(px - t.x, py - t.y) < 34) return { tok: t, fromSlot: i }; }
  for (const t of G.bench) { if (Math.hypot(px - t.x, py - t.y) < 30) return { tok: t, fromSlot: null }; }
  return null;
}
function slotAt(px: number, py: number): number {
  for (let i = 0; i < 6; i++) if (Math.hypot(px - C.SLOTC[i].x, py - C.SLOTC[i].y) < C.SLOT_HALF) return i;
  return -1;
}
function removeFromBench(t: any) { const i = G.bench.indexOf(t); if (i >= 0) G.bench.splice(i, 1); }

export const board = {
  enter(): void {
    if (G.phase !== 'PREP') return;
    const dep = forge.deployables();
    if (!dep.length) { flashHint('还没有可上阵的战舰（需合成到5级“攻击无人机”以上）'); return; }
    let toks = dep.map((b: any) => ({ tier: b.gTier, fac: b.fac, cls: b.cls, star: 1, bodies: [b], x: 0, y: 0 }));
    toks.sort((a: any, b: any) => b.tier - a.tier);
    G.slots = [null, null, null, null, null, null]; G.bench = [];
    toks.forEach((t: any, i: number) => { if (i < 6) G.slots[i] = t; else G.bench.push(t); });
    this.relayout();
    G.phase = 'DEPLOY'; audio.play('deploy'); uiDirty();
    setHint('拖动战舰布阵：前排扛伤/后排输出 · 相同战舰(同级同星)叠一起升星 · 好了点开战');
  },
  relayout(): void {
    G.slots.forEach((t: any, i: number) => { if (t) { t.x = C.SLOTC[i].x; t.y = C.SLOTC[i].y; } });
    G.bench.forEach((t: any, i: number) => { t.x = 66 + i * 74; t.y = 592; });
  },
  dragStart(px: number, py: number): void {
    if (G.phase !== 'DEPLOY') return;
    const hit = tokenAt(px, py); if (!hit) return;
    if (hit.fromSlot != null) G.slots[hit.fromSlot] = null; else removeFromBench(hit.tok);
    G.dragging = { tok: hit.tok, ox: px - hit.tok.x, oy: py - hit.tok.y, fromSlot: hit.fromSlot };
  },
  dragMove(px: number, py: number): void { const d = G.dragging; if (d) { d.tok.x = px - d.ox; d.tok.y = py - d.oy; } },
  dragEnd(px: number, py: number): void {
    if (!G.dragging) return;
    const tok = G.dragging.tok, from = G.dragging.fromSlot, si = slotAt(px, py);
    const backToOrigin = () => { if (from != null) G.slots[from] = tok; else G.bench.push(tok); };
    if (si >= 0) {
      const occ = G.slots[si];
      if (!occ) G.slots[si] = tok;
      else if (occ.tier === tok.tier && occ.star === tok.star && occ.star < 3) {
        occ.star++; occ.bodies = occ.bodies.concat(tok.bodies); G.slots[si] = occ;
        fx.burst(C.SLOTC[si].x, C.SLOTC[si].y, C.FAC[occ.fac].c, 16); fx.setShake(6);
        audio.play('star');
      } else {
        if (from != null) G.slots[from] = occ; else G.bench.push(occ);
        G.slots[si] = tok;
      }
    } else if (py > 545) G.bench.push(tok);
    else backToOrigin();
    G.dragging = null; this.relayout(); uiDirty();
  },
  cancelDrag(): void {
    if (G.dragging) { if (G.dragging.fromSlot != null) G.slots[G.dragging.fromSlot] = G.dragging.tok; else G.bench.push(G.dragging.tok); G.dragging = null; this.relayout(); }
  }
};
