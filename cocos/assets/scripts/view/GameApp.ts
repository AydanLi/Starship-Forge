/* GameApp.ts — 唯一需要挂到场景里的组件（挂在 Canvas 下即可）。
   职责：搭建绘制节点/触摸输入/主循环，把 web 原型 render.js 的全部绘制移植到 Painter。
   逻辑零重复：所有玩法状态来自 core/ 模块。 */
import { _decorator, Component, Node, UITransform, view, EventTouch, Layers } from 'cc';
import { Painter, DESIGN_W, DESIGN_H } from './Painter';
import { TEX, loadTex, tierKey } from './Tex';
import { C, clamp } from '../core/config';
import { G } from '../core/state';
import { STORY } from '../core/storyData';
import { user } from '../core/user';
import { fx } from '../core/fx';
import { audio } from '../core/audio';
import { forge } from '../core/forge';
import { synergy } from '../core/synergy';
import { fleet } from '../core/fleet';
import { econ } from '../core/economy';
import { ads } from '../core/ads';
import { menu, MENU_UI } from '../core/menu';
import * as flow from '../core/flow';

const { ccclass } = _decorator;

// 底部按钮条（游戏坐标，y 760~840 区域）
const BTN_FIRE = { x: 24, y: 772, w: 250, h: 50 };
const BTN_RESET = { x: 286, y: 772, w: 116, h: 50 };
const BTN_MUTE = { x: 414, y: 772, w: 42, h: 50 };

@ccclass('GameApp')
export class GameApp extends Component {
  private root!: Node;
  private p!: Painter;
  private scale = 1;
  private stars: { x: number, y: number, r: number, a: number }[] = [];
  private _err = false;

  onLoad(): void {
    try {
      console.log('[GameApp] onLoad start');
      this.root = new Node('GameRoot');
      this.root.layer = Layers.Enum.UI_2D;
      this.root.addComponent(UITransform);
      this.node.addChild(this.root);
      this.fitScale();
      this.p = new Painter(this.root);
      console.log('[GameApp] painter ready, scale=', this.scale);
      for (let i = 0; i < 130; i++) this.stars.push({ x: Math.random() * 480, y: Math.random() * 760, r: Math.random() * 1.6 + 0.4, a: Math.random() * 0.7 + 0.3 });

      this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
      this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
      this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
      this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

      loadTex();
      flow.boot();
      console.log('[GameApp] boot done, phase=', G.phase);
    } catch (e: any) {
      console.error('[GameApp] onLoad ERROR:', e && e.stack ? e.stack : e);
    }
  }

  private fitScale(): void {
    const vs = view.getVisibleSize();
    this.scale = Math.min(vs.width / DESIGN_W, vs.height / DESIGN_H);
    this.root.setScale(this.scale, this.scale, 1);
  }
  private toGame(e: EventTouch): { x: number, y: number } {
    const ui = e.getUILocation();
    const vs = view.getVisibleSize();
    return {
      x: (ui.x - vs.width / 2) / this.scale + DESIGN_W / 2,
      y: DESIGN_H / 2 - (ui.y - vs.height / 2) / this.scale
    };
  }

  private onTouchStart(e: EventTouch): void {
    const pt = this.toGame(e);
    audio.unlock();
    // 底部按钮条
    const hit = (r: any) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
    if (hit(BTN_MUTE)) { audio.toggle(); return; }
    const m = flow.uiModel();
    if (hit(BTN_FIRE)) { if (m.fireOn) flow.onFire(); return; }
    if (hit(BTN_RESET)) { if (m.resetOn) flow.onReset(); return; }
    if (pt.y <= 760) flow.pointerDown(pt.x, pt.y);
  }
  private onTouchMove(e: EventTouch): void { const pt = this.toGame(e); flow.pointerMove(pt.x, pt.y); }
  private onTouchEnd(e: EventTouch): void { const pt = this.toGame(e); flow.pointerUp(pt.x, pt.y); }
  private onTouchCancel(): void { flow.pointerCancel(); }

  update(dt: number): void {
    try {
      flow.step(Math.min(0.05, dt));
      this.render();
    } catch (e: any) {
      if (!this._err) { this._err = true; console.error('[GameApp] render ERROR:', e && e.stack ? e.stack : e); }
    }
  }

  // ================= 渲染（对应 web render.js） =================
  private render(): void {
    const p = this.p;
    const menuPhase = G.phase === 'LOGIN' || G.phase === 'MENU' || G.phase === 'MAP';
    const sh = menuPhase ? { sx: 0, sy: 0 } : fx.shakeOffset();
    p.begin(sh.sx, sh.sy);

    if (menuPhase) {
      if (G.phase === 'LOGIN') this.drawLogin();
      else if (G.phase === 'MENU') this.drawMenu();
      else this.drawMap();
    } else {
      if (TEX['bg_battle_debris']) {
        p.bgImg(TEX['bg_battle_debris'], 0, 0, 480, 840);
        p.fillRect(-12, -12, C.W + 24, C.H + 24, 'rgba(4,8,16,0.42)');   // 压暗保证可读性
      } else {
        p.fillRect(-12, -12, C.W + 24, C.H + 24, '#070c16');
        this.drawGrid();
      }
      if (G.phase === 'PREP' || G.phase === 'GAMEOVER') this.drawForge();
      else if (G.phase === 'DEPLOY') this.drawDeploy();
      else this.drawArena();
      this.drawTopHud();
      this.drawFx();
      p.layer(1);
      if (G.phase === 'RESULT') this.drawResult();
      if (G.phase === 'GAMEOVER') this.drawOver();
      if (G.story) this.drawStory();
      if (ads.active()) this.drawAd();
      p.layer(0);
    }
    this.drawBottomBar();
    p.end();
  }

  private drawBottomBar(): void {
    const p = this.p; p.layer(1);
    p.fillRect(0, 760, 480, 80, '#060a13');
    const m = flow.uiModel();
    const btn = (r: any, label: string, on: boolean, bc: string, tc: string) => {
      p.roundRect(r.x, r.y, r.w, r.h, 12, '#101d33', bc, 2, on ? 1 : 0.4);
      p.text(label, r.x + r.w / 2, r.y + 31, 15, tc, 'center', true, on ? 1 : 0.4);
    };
    btn(BTN_FIRE, m.fire, m.fireOn, '#ff2e88', '#ff9dc4');
    btn(BTN_RESET, m.reset, m.resetOn, '#00e5ff', '#8fe8ff');
    btn(BTN_MUTE, audio.muted ? '🔇' : '🔊', true, '#5f7797', '#8fb4d6');
    p.text(m.hint, 240, 836, 11, '#6f88a8', 'center');
    p.layer(0);
  }

  private drawGrid(): void {
    const p = this.p;
    for (let x = 0; x <= C.W; x += 40) p.line(x, 0, x, C.H, '#0e1830', 1);
    for (let y = 0; y <= C.H; y += 40) p.line(0, y, C.W, y, '#0e1830', 1);
  }

  private drawTopHud(): void {
    const p = this.p;
    p.text('星区 ' + (G.level + 1) + ' · 第 ' + (G.wave + 1) + '/' + C.WAVES_PER_LEVEL + ' 波', C.CT.left, 30, 14, '#7cf3ff', 'left', true);
    p.text('💰 ' + G.gold + '   分数 ' + G.score, C.CT.right, 30, 14, '#ffd08a', 'right', true);
    const syn = G.phase === 'BATTLE' ? G.pSyn
      : (G.phase === 'DEPLOY' ? synergy.compute(G.slots.filter(Boolean)).active
        : synergy.compute(forge.deployables().map((b: any) => ({ fac: b.fac, cls: b.cls }))).active);
    let x = C.CT.left; const y = 44;
    const lead = G.phase === 'BATTLE' ? '羁绊生效：' : (G.phase === 'DEPLOY' ? '阵中羁绊：' : '当前羁绊：');
    p.text(lead, x, y + 10, 11, '#6f88a8', 'left', true); x += 66;
    if (!syn.length) { p.text('（同阵营/舰种×2激活）', x, y + 10, 11, '#3f5f7a'); }
    for (const s of syn) {
      const w = this.p.measure(s.t, 11) + 14;
      if (x + w > C.CT.right) break;
      p.roundRect(x, y, w, 16, 8, '#101d33', s.c, 1);
      p.text(s.t, x + 7, y + 11, 11, s.c, 'left', true);
      x += w + 5;
    }
  }

  // ---- 熔炉 ----
  private drawForge(): void {
    const p = this.p;
    p.text('下一个：' + C.TIERS[G.nextTier].name, C.CT.left, 76, 11, '#6f88a8');
    p.text('5级起可上阵编队', C.CT.right, 76, 11, '#8fb4d6', 'right');
    for (const b of econ.BTNS) {
      const bx = b.xOf(), paid = b.label().includes('💰');
      p.roundRect(bx, C.EB_Y, C.EB_W, C.EB_H, 9, '#101d33', paid ? '#ffb43d' : '#7cf3ff', 1.5);
      p.text(b.label(), bx + C.EB_W / 2, C.EB_Y + 21, 12, paid ? '#ffd08a' : '#aef5ff', 'center', true);
    }
    p.dashLine(C.CT.left, C.Y_WARN, C.CT.right, C.Y_WARN, '#ff5a5a', 1.4, 6, 5, 0.7);
    p.text('过载线', C.CT.right - 2, C.Y_WARN - 4, 10, '#ff7a7a', 'right');
    p.line(C.CT.left, C.CT.top, C.CT.left, C.CT.floor, '#274063', 3);
    p.line(C.CT.left, C.CT.floor, C.CT.right, C.CT.floor, '#274063', 3);
    p.line(C.CT.right, C.CT.floor, C.CT.right, C.CT.top, '#274063', 3);
    for (const b of forge.bodies()) { if (b.gTier === undefined) continue; this.drawBall(b.position.x, b.position.y, b.gTier, b.fac, b.cls); }
    if (G.current && G.phase === 'PREP') {
      const r = C.TIERS[G.current.tier].r, x = clamp(G.current.x, C.CT.left + r, C.CT.right - r);
      p.dashLine(x, C.Y_DROP + r, x, C.CT.floor, '#8fe8ff', 1, 4, 6, 0.3);
      this.drawBall(x, C.Y_DROP, G.current.tier, undefined, undefined);
    }
  }
  private drawBall(x: number, y: number, tier: number, fac?: number, cls?: number): void {
    const p = this.p, t = C.TIERS[tier], r = t.r;
    const tagged = fac !== undefined && tier >= C.DEPLOY_MIN;
    const sf = TEX[tierKey(tier)];
    if (sf) {
      // 真实美术：战舰图标 + 阵营色外环
      if (tagged) p.circle(x, y, r + 1, undefined, C.FAC[fac!].c, 3);
      else p.circle(x, y, r, undefined, 'rgba(140,190,230,0.35)', 1.2);
      const s = r * 2.3;
      p.img(sf, x, y, s, s);
      if (r >= 22) {
        p.text(t.name, x, y + r - 2, 10, '#bfe8ff', 'center', true);
        if (tagged && cls !== undefined) p.text(C.FAC[fac!].name + '·' + C.CLS[cls].name, x, y - r + 4, 9, C.FAC[fac!].c, 'center', true);
      } else {
        p.text(String(tier + 1), x + r * 0.62, y + r * 0.62, 9, '#9fd0ee', 'center', true);
      }
      return;
    }
    p.circle(x, y, r, t.c);
    p.circle(x - r * 0.3, y - r * 0.3, r * 0.25, '#ffffff', undefined, 1, 0.85);   // 高光点替代径向渐变
    if (tagged) p.circle(x, y, r - 1, undefined, C.FAC[fac!].c, 3.5);
    else p.circle(x, y, r, undefined, '#ffffffcc', 2);
    const fs = Math.max(9, Math.min(15, r * 0.4));
    if (r >= 22) p.text(t.name, x, y + (tagged ? -5 : 0), fs, '#08131f', 'center', true);
    else p.text(String(tier + 1), x, y, fs, '#08131f', 'center', true);
    if (tagged && r >= 22 && cls !== undefined) p.text(C.FAC[fac!].name + '·' + C.CLS[cls].name, x, y + 10, 9, '#08131f', 'center', true);
  }

  // ---- 编队 ----
  private drawDeploy(): void {
    const p = this.p;
    const isBoss = G.wave === C.WAVES_PER_LEVEL - 1;
    p.text(isBoss ? '⚠ 本波：星区 Boss！' : '下一波敌情：普通编队', C.CT.left, 92, 12, '#ff8a9c', 'left', true);
    let ex = C.CT.left;
    for (const e of fleet.genEnemiesPreview(G.level, G.wave)) {
      const s = e.boss ? 16 : 9;
      p.poly([{ x: ex + s, y: 104 }, { x: ex + s * 2, y: 104 - s }, { x: ex, y: 104 - s }], e.boss ? '#ff3b5c' : '#ff6a6a');
      ex += s * 2 + 8;
    }
    p.text('前排（近敌·扛伤）', C.W / 2, 250, 11, '#5f7797', 'center');
    p.text('后排（受保护·输出）', C.W / 2, 452, 11, '#5f7797', 'center');
    for (let i = 0; i < 6; i++) {
      const c = C.SLOTC[i];
      p.roundRect(c.x - C.SLOT_HALF, c.y - C.SLOT_HALF, C.SLOT_HALF * 2, C.SLOT_HALF * 2, 10, undefined, '#2f4d7a', 1.5);
    }
    p.roundRect(C.CT.left, 556, C.CT.right - C.CT.left, 76, 10, undefined, '#1c2e48', 1);
    p.text('待编战舰（拖进上方阵位；相同战舰叠放升星）', C.CT.left + 6, 550, 11, '#6f88a8');
    for (let i = 0; i < 6; i++) if (G.slots[i] && G.slots[i] !== (G.dragging && G.dragging.tok)) this.drawToken(G.slots[i]);
    for (const t of G.bench) if (t !== (G.dragging && G.dragging.tok)) this.drawToken(t);
    if (G.dragging) this.drawToken(G.dragging.tok);
  }
  private drawToken(tok: any): void {
    const p = this.p, t = C.TIERS[tok.tier], r = 32;
    const sf = TEX[tierKey(tok.tier)];
    if (sf) {
      p.circle(tok.x, tok.y, r + 1, undefined, C.FAC[tok.fac].c, 3);
      p.img(sf, tok.x, tok.y, r * 2.3, r * 2.3);
      p.text(t.name, tok.x, tok.y + r - 1, 10, '#bfe8ff', 'center', true);
      p.text(C.FAC[tok.fac].name + '·' + C.CLS[tok.cls].name, tok.x, tok.y - r + 4, 8, C.FAC[tok.fac].c, 'center', true);
    } else {
      p.circle(tok.x, tok.y, r, t.c);
      p.circle(tok.x - r * 0.3, tok.y - r * 0.3, r * 0.22, '#ffffff', undefined, 1, 0.85);
      p.circle(tok.x, tok.y, r - 1, undefined, C.FAC[tok.fac].c, 3.5);
      p.text(t.name, tok.x, tok.y - 2, 10, '#08131f', 'center', true);
      p.text(C.FAC[tok.fac].name + '·' + C.CLS[tok.cls].name, tok.x, tok.y + 9, 8, '#08131f', 'center');
    }
    if (tok.star > 1) p.text('★'.repeat(tok.star), tok.x, tok.y - r - 3, 12, '#ffd54a', 'center', true);
  }

  // ---- 战斗场 ----
  private drawArena(): void {
    const p = this.p;
    p.dashLine(0, 372, C.W, 372, '#16263f', 1, 4, 6);
    p.text('▲ 敌军', C.CT.left, 366, 11, '#5a2130');
    p.text('我方舰队 ▼', C.CT.right, 366, 11, '#1f5a6a', 'right');
    for (const u of G.eUnits) if (u.alive) this.drawUnit(u);
    for (const u of G.pUnits) if (u.alive) this.drawUnit(u);
  }
  private drawUnit(u: any): void {
    const p = this.p;
    const enemy = u.team === 'e', r = u.isBoss ? 40 : (u.summon ? 14 : 16 + u.tier * 1.6);
    const col = enemy ? (u.isBoss ? '#ff3b5c' : '#ff6a6a') : C.FAC[u.fac].c;
    const bossSf = TEX['boss_vulture'];
    const shipSf = (!enemy && !u.summon) ? TEX[tierKey(u.tier)] : (!enemy && u.summon ? TEX[tierKey(4)] : undefined);
    if (enemy && u.isBoss && bossSf) {
      p.img(bossSf, u.x, u.y, r * 2.4, r * 2.4);
    } else if (enemy) {
      p.poly([{ x: u.x, y: u.y + r }, { x: u.x + r, y: u.y - r * 0.7 }, { x: u.x - r, y: u.y - r * 0.7 }], col, '#ffffffbb', 1.5);
    } else if (shipSf) {
      p.circle(u.x, u.y, r + 1, undefined, col, 2.5);
      p.img(shipSf, u.x, u.y, r * 2.3, r * 2.3);
    } else {
      p.circle(u.x, u.y, r, col, '#ffffffbb', 1.5);
      p.circle(u.x - r * 0.3, u.y - r * 0.3, r * 0.22, '#ffffff', undefined, 1, 0.8);
    }
    if (u.shield > 0) p.circle(u.x, u.y, r + 4, undefined, '#7cf3ff', 2, 0.7);
    if (!enemy && u.star > 1) p.text('★'.repeat(u.star), u.x, u.y - r - 14, 11, '#ffd54a', 'center', true);
    const bw = Math.max(26, r * 1.8), bx = u.x - bw / 2, by = u.y - r - 12;
    p.fillRect(bx, by, bw, 5, '#0c1424');
    p.fillRect(bx, by, bw * clamp(u.hp / u.maxHp, 0, 1), 5, enemy ? '#ff4d6a' : '#49e08a');
    if (u.shield > 0) p.fillRect(bx, by - 3, bw * clamp(u.shield / u.maxHp, 0, 1), 2, '#7cf3ff');
    if (!u.summon) p.text(u.isBoss ? u.name : (enemy ? '敌舰' : C.FAC[u.fac].name + C.CLS[u.cls].name), u.x, u.y + r + 12, 9, enemy ? '#ffb0bb' : '#dfeaf7', 'center');
  }

  private drawFx(): void {
    const p = this.p;
    for (const pa of fx.particles) p.circle(pa.x, pa.y, pa.r, pa.color, undefined, 1, Math.max(0, pa.life));
    for (const b of fx.beams) p.line(b.x1, b.y1, b.x2, b.y2, b.c, 2.4, Math.max(0, b.life) * 0.85);
    for (const f of fx.floats) p.text(f.t, f.x, f.y, f.sz, f.color, 'center', true, clamp(f.life, 0, 1));
  }

  // ---- 覆盖层 ----
  private drawResult(): void {
    const p = this.p;
    p.fillRect(0, 0, C.W, C.H, 'rgba(4,8,16,0.72)');
    if (G.result === 'win') {
      p.text('战斗胜利', C.W / 2, C.H / 2 - 30, 34, '#7cf3ff', 'center', true);
      p.text(G.wave === C.WAVES_PER_LEVEL - 1 ? '★ 星区 Boss 已击破！' : '本波清剿完成', C.W / 2, C.H / 2 + 4, 16, '#ffd08a', 'center');
      p.text('金币 +' + G.lastGain, C.W / 2, C.H / 2 + 30, 16, '#aef5ff', 'center');
    } else {
      p.text('舰队覆灭', C.W / 2, C.H / 2 - 30, 34, '#ff5a7a', 'center', true);
      p.text('回熔炉重整旗鼓，凑更强的羁绊/升星再战', C.W / 2, C.H / 2 + 6, 15, '#cfe0f2', 'center');
    }
    p.text('点击下方按钮继续', C.W / 2, C.H / 2 + 52, 12, '#6f88a8', 'center');
    if (G.result === 'win' && !G.goldDoubled) this.drawAdBtn(C.BTN_DOUBLE, '📺 看广告 · 金币双倍 (+' + G.lastGain + ')');
    if (G.result === 'lose') this.drawAdBtn(C.BTN_OVERLOAD, '📺 旗舰超载 · 下次开战全队攻击 +50%');
  }
  private drawAdBtn(r: any, label: string): void {
    const p = this.p;
    p.roundRect(r.x, r.y, r.w, r.h, 10, '#1a2540', '#ffd54a', 2);
    p.text(label, r.x + r.w / 2, r.y + 25, 13, '#ffe08a', 'center', true);
  }
  private drawAd(): void {
    const p = this.p, ad = ads.current()!;
    p.fillRect(0, 0, C.W, C.H, 'rgba(2,4,9,0.94)');
    p.text('📺 模拟激励视频 · ' + ad.label, C.W / 2, C.H / 2 - 70, 20, '#ffd54a', 'center', true);
    p.text(String(Math.ceil(ad.t)), C.W / 2, C.H / 2 + 16, 64, '#ffffff', 'center', true);
    p.text('预览环境模拟；抖音真机自动切换为真实激励视频', C.W / 2, C.H / 2 + 66, 12, '#5f7797', 'center');
  }
  private drawOver(): void {
    const p = this.p;
    p.fillRect(0, 0, C.W, C.H, 'rgba(4,8,16,0.82)');
    p.text('熔炉过载', C.W / 2, C.H / 2 - 20, 34, '#ff5a7a', 'center', true);
    p.text('分数 ' + G.score + ' · 最高合成 ' + C.TIERS[G.bestTier].name, C.W / 2, C.H / 2 + 12, 17, '#cfe0f2', 'center');
    p.text('「返回主界面」或「重新开始」', C.W / 2, C.H / 2 + 44, 13, '#6f88a8', 'center');
  }
  private drawStory(): void {
    const p = this.p, s = G.story;
    p.fillRect(0, 0, C.W, C.H, 'rgba(3,6,12,0.9)');
    const px = 38, pw = C.W - 76, py = 158, ph = 452;
    p.roundRect(px, py, pw, ph, 14, '#0a1524', s.color || '#00e5ff', 2);
    p.roundRect(px, py, pw, 30, 14, s.color || '#00e5ff');
    p.text(s.tag || '', px + 14, py + 20, 14, '#05101c', 'left', true);
    p.text(s.title || '', C.W / 2, py + 66, 22, s.color || '#7cf3ff', 'center', true);
    let y = py + 106; const maxW = pw - 40;
    for (const para of s.lines) {
      for (const ln of this.wrapText(para, 14, maxW)) { p.text(ln, px + 20, y, 14, '#cfe0f2'); y += 25; }
      y += 8;
    }
    p.text('▶ 点击「' + (s.btn || '继续') + '」', C.W / 2, py + ph - 16, 13, '#8fd8ff', 'center', true);
  }
  private wrapText(text: string, size: number, maxW: number): string[] {
    const out: string[] = []; let line = '';
    for (const ch of text) {
      if (this.p.measure(line + ch, size) > maxW && line) { out.push(line); line = ch; } else line += ch;
    }
    if (line) out.push(line);
    return out;
  }

  // ---- 菜单/登录/星图 ----
  private drawStarfield(): void {
    const p = this.p, t = Date.now();
    p.fillRect(-12, -12, C.W + 24, C.H + 24, '#05070f');
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(t / 700 + s.x * 12.9898 + s.y * 78.233);
      p.circle(s.x, s.y, s.r, '#cfe4ff', undefined, 1, s.a * tw);
    }
  }
  private nebula(x: number, y: number, r: number, color: string, alpha: number): void {
    // 径向渐变的近似：三层同心淡圆
    this.p.circle(x, y, r, color, undefined, 1, alpha * 0.25);
    this.p.circle(x, y, r * 0.62, color, undefined, 1, alpha * 0.3);
    this.p.circle(x, y, r * 0.33, color, undefined, 1, alpha * 0.35);
  }
  private bigTitle(y: number): void {
    const p = this.p;
    p.text('星 舰 熔 炉', C.W / 2, y, 46, '#aef5ff', 'center', true);
    p.text('— 大寂灭之后 · 杀出一条回家的路 —', C.W / 2, y + 30, 13, '#5f7797', 'center');
  }
  private menuBtn(r: any, label: string, sub: string, color: string): void {
    const p = this.p;
    p.roundRect(r.x, r.y, r.w, r.h, 12, '#0c1728', color, 2);
    p.text(label, r.x + r.w / 2, r.y + (sub ? 26 : 35), 19, color, 'center', true);
    if (sub) p.text(sub, r.x + r.w / 2, r.y + 44, 10, '#5f7797', 'center');
  }
  private menuBg(key: string): boolean {
    if (!TEX[key]) return false;
    this.p.bgImg(TEX[key], 0, 0, 480, 840);
    this.p.fillRect(-12, -12, C.W + 24, C.H + 24, 'rgba(3,6,12,0.34)');   // 压暗提升文字对比
    return true;
  }
  private drawLogin(): void {
    const p = this.p;
    if (!this.menuBg('bg_menu_flagship')) {
      this.drawStarfield();
      this.nebula(120, 200, 220, '#0a2a3a', 0.5); this.nebula(390, 620, 260, '#241030', 0.5);
    }
    this.bigTitle(200);
    p.text('残存舰队正在等待新的指挥官', C.W / 2, 300, 14, '#8fb4d6', 'center');
    p.text('▼ 点击下方输入指挥官代号（2~12字）', C.W / 2, 336, 13, '#6f88a8', 'center', true);
    const B = MENU_UI.LOGIN_BOX;
    p.roundRect(B.x, B.y, B.w, B.h, 12, '#0c1728', '#00e5ff', 2);
    if (G.pendingName) p.text(G.pendingName, B.x + B.w / 2, B.y + 31, 17, '#aef5ff', 'center', true);
    else p.text('点 击 输 入 代 号', B.x + B.w / 2, B.y + 31, 15, '#3f5f7a', 'center');
    p.text('代号即用户ID · 每位指挥官拥有独立的征程存档', C.W / 2, 440, 11, '#3f5f7a', 'center');
    p.text('正式版将接入抖音登录（tt.login → openid）', C.W / 2, 460, 11, '#3f5f7a', 'center');
  }
  private drawMenu(): void {
    const p = this.p;
    if (!this.menuBg('bg_menu_flagship')) {
      this.drawStarfield();
      this.nebula(100, 160, 200, '#0a2a3a', 0.55); this.nebula(400, 300, 180, '#241030', 0.5); this.nebula(240, 700, 260, '#0a1f2e', 0.5);
    }
    this.bigTitle(190);
    p.text('指挥官 ' + (user.name() || '—'), C.W / 2, 268, 14, '#ffd08a', 'center', true);
    const prog = G.maxLevel >= 5 ? '已抵达新伊甸 · 无尽征战中' : ('征程进度：星区 ' + (G.maxLevel + 1) + ' / 5');
    p.text(prog + ' · 💰' + G.gold + ' · 分数 ' + G.score, C.W / 2, 288, 11, '#6f88a8', 'center');
    this.menuBtn(MENU_UI.MBTN.start, '▶ 开始游戏', G.level > 0 || G.wave > 0 ? '续档：星区 ' + (G.level + 1) + ' · 第 ' + (G.wave + 1) + ' 波' : '从大寂灭的残骸中启航', '#7cf3ff');
    this.menuBtn(MENU_UI.MBTN.map, '🗺 关卡选择', '打开星图 · 选择跳跃目标', '#ffb43d');
    this.menuBtn(MENU_UI.MBTN.set, '⚙ 系统设置', '音效 / 存档 / 切换指挥官', '#b06bff');
    p.text('星舰熔炉 Cocos 版 · 掉落合成 × 自走棋', C.W / 2, 726, 10, '#31445c', 'center');
    if (G.panel === 'settings') this.drawSettings();
  }
  private drawSettings(): void {
    const p = this.p, P = MENU_UI.SET_PANEL, R = MENU_UI.SET_ROWS;
    p.layer(1);
    p.fillRect(0, 0, C.W, C.H, 'rgba(3,6,12,0.8)');
    p.roundRect(P.x, P.y, P.w, P.h, 14, '#0a1524', '#b06bff', 2);
    p.text('⚙ 系统设置', C.W / 2, P.y + 34, 18, '#c3a6ff', 'center', true);
    const row = (r: any, label: string, color: string) => {
      p.roundRect(r.x, r.y, r.w, r.h, 10, '#101d33', color, 1.5);
      p.text(label, r.x + r.w / 2, r.y + 29, 14, color, 'center', true);
    };
    row(R.sound, '音效：' + (audio.muted ? '已关闭 🔇' : '已开启 🔊'), '#7cf3ff');
    row(R.wipe, '清除本账号存档', '#ffb43d');
    row(R.logout, '切换指挥官（退出登录）', '#ff8a9c');
    row(R.close, '关 闭', '#8fb4d6');
    p.layer(0);
  }
  private drawMap(): void {
    const p = this.p;
    const secCol = ['#00e5ff', '#5fb0ff', '#ff2e5b', '#b06bff', '#ffb43d'];
    if (!this.menuBg('bg_starmap')) this.drawStarfield();
    MENU_UI.NODES.forEach((n, i) => this.nebula(n.x, n.y, 120, secCol[i], i <= menu.maxUnlocked() ? 0.16 : 0.05));
    p.text('✦ 归途星图 ✦', C.W / 2, 46, 20, '#7cf3ff', 'center', true);
    p.text('从残骸带到新伊甸 · 五重封锁', C.W / 2, 66, 11, '#5f7797', 'center');
    const path = [{ x: 240, y: 690 } as any].concat(MENU_UI.NODES as any, [MENU_UI.EDEN as any]);
    for (let i = 0; i < path.length - 1; i++) {
      const unlocked = i <= menu.maxUnlocked();
      p.dashLine(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y, unlocked ? '#7cf3ff' : '#506482', 2, 6, 7, unlocked ? 0.55 : 0.25);
    }
    p.circle(MENU_UI.EDEN.x, MENU_UI.EDEN.y, 14, '#ffe66a');
    p.text('新伊甸 · 家园', MENU_UI.EDEN.x, MENU_UI.EDEN.y - 24, 13, '#ffe66a', 'center', true);
    p.text(G.maxLevel >= 5 ? '封锁已破 · 晨光在望' : '被五重封锁隔绝', MENU_UI.EDEN.x, MENU_UI.EDEN.y + 30, 10, '#8a7a3a', 'center');
    p.text('▲ 星炉号 · 启航点', 240, 712, 11, '#8fb4d6', 'center');
    MENU_UI.NODES.forEach((n, i) => {
      const unlocked = i <= menu.maxUnlocked(), cur = i === G.level;
      const col = unlocked ? secCol[i] : '#3a4a60';
      p.circle(n.x, n.y, 30, '#0c1728', col, cur ? 3.5 : 2);
      p.text(unlocked ? String(i + 1) : '🔒', n.x, n.y + 5, 15, unlocked ? col : '#4a5a70', 'center', true);
      const tag = STORY.SECTORS[i].tag;
      p.text(tag.indexOf(' · ') >= 0 ? tag.split(' · ')[1] : tag, n.x, n.y - 42, 12, unlocked ? col : '#4a5a70', 'center', true);
      p.text(unlocked ? ('BOSS：' + STORY.BOSS_NAMES[i]) : '航道封锁 · 信号未探明', n.x, n.y + 48, 10, unlocked ? '#8fb4d6' : '#3f5069', 'center');
      if (cur) p.text('📍 当前位置 · 第 ' + (G.wave + 1) + '/3 波', n.x, n.y + 62, 10, '#7cf3ff', 'center', true);
    });
  }
}
