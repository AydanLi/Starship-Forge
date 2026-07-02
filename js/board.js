/* board.js — 系统层：编队。阵位/待编区/拖拽/升星（同级同星叠放）。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  function tokenAt(px, py) {
    const G = SF.G;
    for (let i = 0; i < 6; i++) { const t = G.slots[i]; if (t && Math.hypot(px - t.x, py - t.y) < 34) return { tok: t, fromSlot: i }; }
    for (const t of G.bench) { if (Math.hypot(px - t.x, py - t.y) < 30) return { tok: t, fromSlot: null }; }
    return null;
  }
  function slotAt(px, py) {
    const C = SF.C;
    for (let i = 0; i < 6; i++) if (Math.hypot(px - C.SLOTC[i].x, py - C.SLOTC[i].y) < C.SLOT_HALF) return i;
    return -1;
  }
  function removeFromBench(t) { const b = SF.G.bench, i = b.indexOf(t); if (i >= 0) b.splice(i, 1); }

  SF.board = {
    enter() {
      const G = SF.G;
      if (G.phase !== 'PREP') return;
      const dep = SF.forge.deployables();
      if (!dep.length) { SF.ui.flashHint('还没有可上阵的战舰（需合成到5级“攻击无人机”以上）'); return; }
      // token 引用熔炉刚体，开战时才消耗
      let toks = dep.map(b => ({ tier: b.gTier, fac: b.fac, cls: b.cls, star: 1, bodies: [b], x: 0, y: 0 }));
      toks.sort((a, b) => b.tier - a.tier);
      G.slots = [null, null, null, null, null, null]; G.bench = [];
      toks.forEach((t, i) => { if (i < 6) G.slots[i] = t; else G.bench.push(t); });
      this.relayout();
      G.phase = 'DEPLOY'; SF.ui.update();
      SF.ui.setHint('拖动战舰布阵：前排扛伤/后排输出 · 相同战舰(同级同星)叠一起升星 · 好了点开战');
    },
    relayout() {
      const G = SF.G, C = SF.C;
      G.slots.forEach((t, i) => { if (t) { t.x = C.SLOTC[i].x; t.y = C.SLOTC[i].y; } });
      G.bench.forEach((t, i) => { t.x = 66 + i * 74; t.y = 592; });
    },
    dragStart(px, py) {
      const G = SF.G;
      if (G.phase !== 'DEPLOY') return;
      const hit = tokenAt(px, py); if (!hit) return;
      if (hit.fromSlot != null) G.slots[hit.fromSlot] = null; else removeFromBench(hit.tok);
      G.dragging = { tok: hit.tok, ox: px - hit.tok.x, oy: py - hit.tok.y, fromSlot: hit.fromSlot };
    },
    dragMove(px, py) { const d = SF.G.dragging; if (d) { d.tok.x = px - d.ox; d.tok.y = py - d.oy; } },
    dragEnd(px, py) {
      const G = SF.G, C = SF.C;
      if (!G.dragging) return;
      const tok = G.dragging.tok, from = G.dragging.fromSlot, si = slotAt(px, py);
      const backToOrigin = () => { if (from != null) G.slots[from] = tok; else G.bench.push(tok); };
      if (si >= 0) {
        const occ = G.slots[si];
        if (!occ) G.slots[si] = tok;
        else if (occ.tier === tok.tier && occ.star === tok.star && occ.star < 3) {   // 升星
          occ.star++; occ.bodies = occ.bodies.concat(tok.bodies); G.slots[si] = occ;
          SF.fx.burst(C.SLOTC[si].x, C.SLOTC[si].y, C.FAC[occ.fac].c, 16); SF.fx.setShake(6);
        } else {                                                                      // 交换
          if (from != null) G.slots[from] = occ; else G.bench.push(occ);
          G.slots[si] = tok;
        }
      } else if (py > 545) G.bench.push(tok);   // 丢回待编区
      else backToOrigin();
      G.dragging = null; this.relayout(); SF.ui.update();
    },
    cancelDrag() {
      const G = SF.G;
      if (G.dragging) { if (G.dragging.fromSlot != null) G.slots[G.dragging.fromSlot] = G.dragging.tok; else G.bench.push(G.dragging.tok); G.dragging = null; this.relayout(); }
    }
  };
})();
