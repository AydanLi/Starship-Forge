/* render.js — 表现层：全部 canvas 绘制。只读状态，绝不修改 G。
   迁移 Cocos 时整个文件被节点/预制体替代，其余模块不动。 */
window.SF = window.SF || {};
(function () {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = SF.C.W * dpr; cv.height = SF.C.H * dpr; ctx.scale(dpr, dpr);
  }
  const { clamp } = SF.util;

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, p) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * (1 + p)), 0, 255); g = clamp(Math.round(g * (1 + p)), 0, 255); b = clamp(Math.round(b * (1 + p)), 0, 255); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  function wrapText(text, maxW) { const out = []; let line = ''; for (const ch of text) { const t = line + ch; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; } if (line) out.push(line); return out; }

  function drawGrid() {
    const C = SF.C;
    ctx.strokeStyle = '#0e1830'; ctx.lineWidth = 1;
    for (let x = 0; x <= C.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.H); ctx.stroke(); }
    for (let y = 0; y <= C.H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.W, y); ctx.stroke(); }
  }
  function drawTopHud() {
    const G = SF.G, C = SF.C;
    ctx.textAlign = 'left'; ctx.fillStyle = '#7cf3ff'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('星区 ' + (G.level + 1) + ' · 第 ' + (G.wave + 1) + '/' + C.WAVES_PER_LEVEL + ' 波', C.CT.left, 30);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd08a'; ctx.fillText('💰 ' + G.gold + '   分数 ' + G.score, C.CT.right, 30); ctx.textAlign = 'left';
    let syn = G.phase === 'BATTLE' ? G.pSyn
      : (G.phase === 'DEPLOY' ? SF.synergy.compute(G.slots.filter(Boolean)).active
        : SF.synergy.compute(SF.forge.deployables().map(b => ({ fac: b.fac, cls: b.cls }))).active);
    let x = C.CT.left, y = 44; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#6f88a8';
    const lead = G.phase === 'BATTLE' ? '羁绊生效：' : (G.phase === 'DEPLOY' ? '阵中羁绊：' : '当前羁绊：');
    ctx.fillText(lead, x, y + 10); x += 66;
    if (!syn.length) { ctx.fillStyle = '#3f5f7a'; ctx.fillText('（同阵营/舰种×2激活）', x, y + 10); }
    for (const s of syn) { const w = ctx.measureText(s.t).width + 14; if (x + w > C.CT.right) break; ctx.fillStyle = '#101d33'; ctx.strokeStyle = s.c; ctx.lineWidth = 1; roundRect(x, y, w, 16, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = s.c; ctx.fillText(s.t, x + 7, y + 11); x += w + 5; }
  }

  // ---- 熔炉 ----
  function drawForge() {
    const G = SF.G, C = SF.C;
    ctx.fillStyle = '#6f88a8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('下一个：' + C.TIERS[G.nextTier].name, C.CT.left, 76);
    ctx.textAlign = 'right'; ctx.fillStyle = '#8fb4d6'; ctx.fillText('5级起可上阵编队', C.CT.right, 76); ctx.textAlign = 'left';
    // 经济按钮
    for (const b of SF.econ.BTNS) {
      const bx = b.xOf(C), paid = b.label().includes('💰');
      ctx.fillStyle = '#101d33'; ctx.strokeStyle = paid ? '#ffb43d' : '#7cf3ff'; ctx.lineWidth = 1.5;
      roundRect(bx, C.EB_Y, C.EB_W, C.EB_H, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = paid ? '#ffd08a' : '#aef5ff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.label(), bx + C.EB_W / 2, C.EB_Y + 21);
    }
    ctx.textAlign = 'left';
    // 过载线
    ctx.strokeStyle = '#ff5a5a'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.4; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(C.CT.left, C.Y_WARN); ctx.lineTo(C.CT.right, C.Y_WARN); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff7a7a'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('过载线', C.CT.right - 2, C.Y_WARN - 4); ctx.textAlign = 'left';
    // 容器壁
    ctx.strokeStyle = '#274063'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(C.CT.left, C.CT.top); ctx.lineTo(C.CT.left, C.CT.floor); ctx.lineTo(C.CT.right, C.CT.floor); ctx.lineTo(C.CT.right, C.CT.top); ctx.stroke();
    // 球体
    for (const b of SF.forge.bodies()) { if (b.gTier === undefined) continue; drawBall(b.position.x, b.position.y, b.gTier, b.angle, b.fac, b.cls); }
    if (G.current && G.phase === 'PREP') {
      const r = C.TIERS[G.current.tier].r, x = clamp(G.current.x, C.CT.left + r, C.CT.right - r);
      ctx.globalAlpha = 0.3; ctx.strokeStyle = '#8fe8ff'; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(x, C.Y_DROP + r); ctx.lineTo(x, C.CT.floor); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      drawBall(x, C.Y_DROP, G.current.tier, 0);
    }
  }
  function drawBall(x, y, tier, ang, fac, cls) {
    const C = SF.C, t = C.TIERS[tier], r = t.r, tagged = fac !== undefined && tier >= C.DEPLOY_MIN;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(0.25, t.c); g.addColorStop(1, shade(t.c, -0.45));
    ctx.shadowColor = t.c; ctx.shadowBlur = 12; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    if (tagged) { ctx.strokeStyle = C.FAC[fac].c; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, 7); ctx.stroke(); }
    else { ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    ctx.rotate(-(ang || 0)); ctx.fillStyle = '#08131f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.max(9, Math.min(15, r * 0.4)) + 'px sans-serif';
    if (r >= 22) ctx.fillText(t.name, 0, tagged ? -5 : 0); else ctx.fillText((tier + 1), 0, 0);
    if (tagged && r >= 22 && cls !== undefined) { ctx.fillStyle = '#08131f'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(C.FAC[fac].name + '·' + C.CLS[cls].name, 0, 10); }
    ctx.textBaseline = 'alphabetic'; ctx.restore();
  }

  // ---- 编队 ----
  function drawDeploy() {
    const G = SF.G, C = SF.C;
    ctx.textAlign = 'left'; ctx.fillStyle = '#ff8a9c'; ctx.font = 'bold 12px sans-serif';
    const isBoss = G.wave === C.WAVES_PER_LEVEL - 1;
    ctx.fillText(isBoss ? '⚠ 本波：星区 Boss！' : '下一波敌情：普通编队', C.CT.left, 92);
    const preview = SF.fleet.genEnemiesPreview(G.level, G.wave);
    let ex = C.CT.left;
    for (const e of preview) { ctx.fillStyle = e.boss ? '#ff3b5c' : '#ff6a6a'; const s = e.boss ? 16 : 9; ctx.beginPath(); ctx.moveTo(ex + s, 104); ctx.lineTo(ex + s * 2, 104 - s); ctx.lineTo(ex, 104 - s); ctx.closePath(); ctx.fill(); ex += s * 2 + 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = '#5f7797'; ctx.font = '11px sans-serif';
    ctx.fillText('前排（近敌·扛伤）', C.W / 2, 250); ctx.fillText('后排（受保护·输出）', C.W / 2, 452);
    for (let i = 0; i < 6; i++) { const c = C.SLOTC[i]; ctx.strokeStyle = '#2f4d7a'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; roundRect(c.x - C.SLOT_HALF, c.y - C.SLOT_HALF, C.SLOT_HALF * 2, C.SLOT_HALF * 2, 10); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = '#1c2e48'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); roundRect(C.CT.left, 556, C.CT.right - C.CT.left, 76, 10); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#6f88a8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('待编战舰（拖进上方阵位；相同战舰叠放升星）', C.CT.left + 6, 550);
    for (let i = 0; i < 6; i++) if (G.slots[i] && G.slots[i] !== (G.dragging && G.dragging.tok)) drawToken(G.slots[i]);
    for (const t of G.bench) if (t !== (G.dragging && G.dragging.tok)) drawToken(t);
    if (G.dragging) drawToken(G.dragging.tok, true);
  }
  function drawToken(tok, drag) {
    const C = SF.C, t = C.TIERS[tok.tier], r = 32;
    ctx.save(); ctx.translate(tok.x, tok.y);
    if (drag) { ctx.shadowColor = '#000'; ctx.shadowBlur = 12; }
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(0.3, t.c); g.addColorStop(1, shade(t.c, -0.5));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = C.FAC[tok.fac].c; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#08131f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(t.name, 0, -2);
    ctx.font = '8px sans-serif'; ctx.fillText(C.FAC[tok.fac].name + '·' + C.CLS[tok.cls].name, 0, 9);
    ctx.textBaseline = 'alphabetic';
    if (tok.star > 1) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('★'.repeat(tok.star), 0, -r - 3); }
    ctx.restore();
  }

  // ---- 战斗场 ----
  function drawArena() {
    const G = SF.G, C = SF.C;
    ctx.strokeStyle = '#16263f'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(0, 372); ctx.lineTo(C.W, 372); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#5a2130'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('▲ 敌军', C.CT.left, 366);
    ctx.fillStyle = '#1f5a6a'; ctx.textAlign = 'right'; ctx.fillText('我方舰队 ▼', C.CT.right, 366); ctx.textAlign = 'left';
    for (const u of G.eUnits) if (u.alive) drawUnit(u);
    for (const u of G.pUnits) if (u.alive) drawUnit(u);
  }
  function drawUnit(u) {
    const C = SF.C;
    const enemy = u.team === 'e', r = u.isBoss ? 40 : (u.summon ? 14 : 16 + u.tier * 1.6), col = enemy ? (u.isBoss ? '#ff3b5c' : '#ff6a6a') : C.FAC[u.fac].c;
    ctx.save(); ctx.translate(u.x, u.y);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(0.3, col); g.addColorStop(1, shade(col, -0.5));
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillStyle = g;
    if (enemy) { ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.7); ctx.lineTo(-r, -r * 0.7); ctx.closePath(); ctx.fill(); } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 1.5;
    if (enemy) { ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(r, -r * 0.7); ctx.lineTo(-r, -r * 0.7); ctx.closePath(); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    if (u.shield > 0) { ctx.strokeStyle = '#7cf3ff'; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    if (!enemy && u.star > 1) { ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★'.repeat(u.star), 0, -r - 14); }
    ctx.restore();
    const bw = Math.max(26, r * 1.8), bx = u.x - bw / 2, by = u.y - r - 12;
    ctx.fillStyle = '#0c1424'; ctx.fillRect(bx, by, bw, 5);
    ctx.fillStyle = enemy ? '#ff4d6a' : '#49e08a'; ctx.fillRect(bx, by, bw * clamp(u.hp / u.maxHp, 0, 1), 5);
    if (u.shield > 0) { ctx.fillStyle = '#7cf3ff'; ctx.fillRect(bx, by - 3, bw * clamp(u.shield / u.maxHp, 0, 1), 2); }
    if (!u.summon) { ctx.fillStyle = enemy ? '#ffb0bb' : '#dfeaf7'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(u.isBoss ? u.name : (enemy ? '敌舰' : C.FAC[u.fac].name + C.CLS[u.cls].name), u.x, u.y + r + 12); ctx.textAlign = 'left'; }
  }

  // ---- 覆盖层 ----
  function drawResult() {
    const G = SF.G, C = SF.C;
    ctx.fillStyle = 'rgba(4,8,16,0.72)'; ctx.fillRect(0, 0, C.W, C.H); ctx.textAlign = 'center';
    if (G.result === 'win') {
      ctx.fillStyle = '#7cf3ff'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('战斗胜利', C.W / 2, C.H / 2 - 30);
      ctx.fillStyle = '#ffd08a'; ctx.font = '16px sans-serif'; ctx.fillText(G.wave === C.WAVES_PER_LEVEL - 1 ? '★ 星区 Boss 已击破！' : '本波清剿完成', C.W / 2, C.H / 2 + 4);
      ctx.fillStyle = '#aef5ff'; ctx.fillText('金币 +' + G.lastGain, C.W / 2, C.H / 2 + 30);
    } else {
      ctx.fillStyle = '#ff5a7a'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('舰队覆灭', C.W / 2, C.H / 2 - 30);
      ctx.fillStyle = '#cfe0f2'; ctx.font = '15px sans-serif'; ctx.fillText('回熔炉重整旗鼓，凑更强的羁绊/升星再战', C.W / 2, C.H / 2 + 6);
    }
    ctx.fillStyle = '#6f88a8'; ctx.font = '12px sans-serif'; ctx.fillText('点击下方按钮继续', C.W / 2, C.H / 2 + 52); ctx.textAlign = 'left';
    if (G.result === 'win' && !G.goldDoubled) drawAdBtn(C.BTN_DOUBLE, '📺 看广告 · 金币双倍 (+' + G.lastGain + ')');
    if (G.result === 'lose') drawAdBtn(C.BTN_OVERLOAD, '📺 旗舰超载 · 下次开战全队攻击 +50%');
  }
  function drawAdBtn(r, label) {
    ctx.fillStyle = '#1a2540'; ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2;
    roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, r.y + 25); ctx.textAlign = 'left';
  }
  function drawAd() {
    const C = SF.C, ad = SF.ads.current();
    ctx.fillStyle = 'rgba(2,4,9,0.94)'; ctx.fillRect(0, 0, C.W, C.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('📺 模拟激励视频 · ' + ad.label, C.W / 2, C.H / 2 - 70);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 64px sans-serif'; ctx.fillText(Math.ceil(ad.t), C.W / 2, C.H / 2 + 16);
    ctx.fillStyle = '#5f7797'; ctx.font = '12px sans-serif';
    ctx.fillText('原型演示：正式版此处接抖音激励视频 SDK', C.W / 2, C.H / 2 + 66);
    ctx.fillText('（tt.createRewardedVideoAd，看完发放奖励）', C.W / 2, C.H / 2 + 86);
    ctx.textAlign = 'left';
  }
  function drawOver() {
    const G = SF.G, C = SF.C;
    ctx.fillStyle = 'rgba(4,8,16,0.82)'; ctx.fillRect(0, 0, C.W, C.H); ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a7a'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('熔炉过载', C.W / 2, C.H / 2 - 20);
    ctx.fillStyle = '#cfe0f2'; ctx.font = '17px sans-serif'; ctx.fillText('分数 ' + G.score + ' · 最高合成 ' + C.TIERS[G.bestTier].name, C.W / 2, C.H / 2 + 12);
    ctx.fillStyle = '#6f88a8'; ctx.font = '13px sans-serif'; ctx.fillText('点击「重新开始」', C.W / 2, C.H / 2 + 44); ctx.textAlign = 'left';
  }
  function drawStory() {
    const C = SF.C, s = SF.G.story;
    ctx.fillStyle = 'rgba(3,6,12,0.9)'; ctx.fillRect(0, 0, C.W, C.H);
    const px = 38, pw = C.W - 76, py = 158, ph = 452;
    ctx.fillStyle = '#0a1524'; ctx.strokeStyle = s.color || '#00e5ff'; ctx.lineWidth = 2; roundRect(px, py, pw, ph, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = s.color || '#00e5ff'; roundRect(px, py, pw, 30, 14); ctx.fill();
    ctx.fillStyle = '#05101c'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(s.tag || '', px + 14, py + 20);
    ctx.fillStyle = s.color || '#7cf3ff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s.title || '', C.W / 2, py + 66);
    ctx.fillStyle = '#cfe0f2'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
    let y = py + 106; const maxW = pw - 40;
    for (const para of s.lines) { for (const ln of wrapText(para, maxW)) { ctx.fillText(ln, px + 20, y); y += 25; } y += 8; }
    ctx.fillStyle = '#8fd8ff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ 点击「' + (s.btn || '继续') + '」', C.W / 2, py + ph - 16); ctx.textAlign = 'left';
  }

  SF.render = {
    cv, ctx,
    draw() {
      const G = SF.G, C = SF.C;
      const { sx, sy } = SF.fx.shakeOffset();
      ctx.save(); ctx.translate(sx, sy);
      ctx.fillStyle = '#070c16'; ctx.fillRect(-12, -12, C.W + 24, C.H + 24); drawGrid();
      if (G.phase === 'PREP' || G.phase === 'GAMEOVER') drawForge();
      else if (G.phase === 'DEPLOY') drawDeploy();
      else drawArena();
      drawTopHud();
      SF.fx.draw(ctx);
      if (G.phase === 'RESULT') drawResult();
      if (G.phase === 'GAMEOVER') drawOver();
      if (G.story) drawStory();
      if (SF.ads.active()) drawAd();
      ctx.restore();
    }
  };
})();
