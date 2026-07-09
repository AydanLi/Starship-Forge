/* Painter.ts — 视图层画笔：Graphics(矢量) + Label池(文字)，
   提供与 canvas 2D 同形的接口，游戏坐标系与 web 原型一致（左上原点 480x840，含底部按钮条）。
   两个图层：0=场景，1=覆盖层（结算/剧情/广告/设置面板），保证遮罩能盖住场景文字。 */
import { Node, Graphics, Label, Color, UITransform, Layers, Sprite, SpriteFrame } from 'cc';

export const DESIGN_W = 480;
export const DESIGN_H = 840;   // 760 游戏区 + 80 底部按钮条

const colorCache = new Map<string, Color>();
function parseColor(s: string, alpha: number): Color {
  const key = s + '|' + alpha;
  const hit = colorCache.get(key);
  if (hit) return hit;
  const c = parseColorRaw(s, alpha);
  if (colorCache.size < 512) colorCache.set(key, c);   // 上限防动态色串撑爆
  return c;
}
function parseColorRaw(s: string, alpha: number): Color {
  let r = 255, g = 255, b = 255, a = 255;
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    r = parseInt(hex.slice(0, 2), 16); g = parseInt(hex.slice(2, 4), 16); b = parseInt(hex.slice(4, 6), 16);
    if (hex.length >= 8) a = parseInt(hex.slice(6, 8), 16);
  } else if (s.startsWith('rgba')) {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(',').map(x => parseFloat(x)); r = p[0]; g = p[1]; b = p[2]; if (p.length > 3) a = Math.round(p[3] * 255); }
  } else if (s.startsWith('rgb')) {
    const m = s.match(/rgb\(([^)]+)\)/);
    if (m) { const p = m[1].split(',').map(x => parseFloat(x)); r = p[0]; g = p[1]; b = p[2]; }
  }
  return new Color(r, g, b, Math.round(a * alpha));
}

class Layer {
  gfx: Graphics;
  bgRoot: Node;   // 背景图池：矢量之下
  sprRoot: Node;  // 精灵池：矢量之上、文字之下
  labelRoot: Node;
  labels: Label[] = [];
  used = 0;
  bgs: Sprite[] = [];
  bgUsed = 0;
  sprites: Sprite[] = [];
  sprUsed = 0;
  constructor(parent: Node, name: string) {
    this.bgRoot = new Node(name + '_bgs');
    this.bgRoot.layer = Layers.Enum.UI_2D;
    this.bgRoot.addComponent(UITransform);
    parent.addChild(this.bgRoot);
    const gn = new Node(name + '_gfx');
    gn.layer = Layers.Enum.UI_2D;
    gn.addComponent(UITransform);
    this.gfx = gn.addComponent(Graphics);
    parent.addChild(gn);
    this.sprRoot = new Node(name + '_sprites');
    this.sprRoot.layer = Layers.Enum.UI_2D;
    this.sprRoot.addComponent(UITransform);
    parent.addChild(this.sprRoot);
    this.labelRoot = new Node(name + '_labels');
    this.labelRoot.layer = Layers.Enum.UI_2D;
    this.labelRoot.addComponent(UITransform);
    parent.addChild(this.labelRoot);
  }
  label(): Label {
    if (this.used < this.labels.length) { const l = this.labels[this.used++]; l.node.active = true; return l; }
    const n = new Node('lb' + this.labels.length);
    n.layer = Layers.Enum.UI_2D;
    n.addComponent(UITransform);
    const l = n.addComponent(Label);
    l.cacheMode = Label.CacheMode.NONE;
    this.labelRoot.addChild(n);
    this.labels.push(l); this.used++;
    return l;
  }
  private spriteFrom(pool: Sprite[], root: Node, used: number): Sprite {
    if (used < pool.length) { const s = pool[used]; s.node.active = true; return s; }
    const n = new Node('sp' + pool.length);
    n.layer = Layers.Enum.UI_2D;
    n.addComponent(UITransform);
    const s = n.addComponent(Sprite);
    s.sizeMode = Sprite.SizeMode.CUSTOM;
    root.addChild(n);
    pool.push(s);
    return s;
  }
  sprite(): Sprite { const s = this.spriteFrom(this.sprites, this.sprRoot, this.sprUsed); this.sprUsed++; return s; }
  bgSprite(): Sprite { const s = this.spriteFrom(this.bgs, this.bgRoot, this.bgUsed); this.bgUsed++; return s; }
  begin(): void { this.gfx.clear(); this.used = 0; this.sprUsed = 0; this.bgUsed = 0; }
  end(): void {
    for (let i = this.used; i < this.labels.length; i++) this.labels[i].node.active = false;
    for (let i = this.sprUsed; i < this.sprites.length; i++) this.sprites[i].node.active = false;
    for (let i = this.bgUsed; i < this.bgs.length; i++) this.bgs[i].node.active = false;
  }
}

export class Painter {
  private layers: Layer[] = [];
  private cur!: Layer;
  private offX = 0; private offY = 0;

  constructor(root: Node) {
    this.layers.push(new Layer(root, 'scene'));
    this.layers.push(new Layer(root, 'overlay'));
    this.cur = this.layers[0];
  }
  /** 每帧开始：清空两层，设置屏震偏移（作用于场景层坐标） */
  begin(shakeX: number, shakeY: number): void {
    this.offX = shakeX; this.offY = shakeY;
    for (const l of this.layers) l.begin();
    this.cur = this.layers[0];
  }
  end(): void { for (const l of this.layers) l.end(); }
  layer(i: number): void { this.cur = this.layers[i]; }

  // 游戏坐标(左上原点) → 节点本地坐标(中心原点、y向上)
  private tx(x: number): number { return x - DESIGN_W / 2 + this.offX; }
  private ty(y: number): number { return DESIGN_H / 2 - y - this.offY; }

  fillRect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const g = this.cur.gfx;
    g.fillColor = parseColor(color, alpha);
    g.rect(this.tx(x), this.ty(y + h), w, h); g.fill();
  }
  roundRect(x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1, alpha = 1): void {
    const g = this.cur.gfx;
    if (fill) { g.fillColor = parseColor(fill, alpha); g.roundRect(this.tx(x), this.ty(y + h), w, h, r); g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeColor = parseColor(stroke, alpha); g.roundRect(this.tx(x), this.ty(y + h), w, h, r); g.stroke(); }
  }
  circle(x: number, y: number, r: number, fill?: string, stroke?: string, lw = 1, alpha = 1): void {
    const g = this.cur.gfx;
    if (fill) { g.fillColor = parseColor(fill, alpha); g.circle(this.tx(x), this.ty(y), r); g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeColor = parseColor(stroke, alpha); g.circle(this.tx(x), this.ty(y), r); g.stroke(); }
  }
  poly(pts: { x: number, y: number }[], fill?: string, stroke?: string, lw = 1, alpha = 1): void {
    const g = this.cur.gfx;
    g.moveTo(this.tx(pts[0].x), this.ty(pts[0].y));
    for (let i = 1; i < pts.length; i++) g.lineTo(this.tx(pts[i].x), this.ty(pts[i].y));
    g.close();
    if (fill) { g.fillColor = parseColor(fill, alpha); g.fill(); }
    if (stroke) { g.lineWidth = lw; g.strokeColor = parseColor(stroke, alpha); g.stroke(); }
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, lw = 1, alpha = 1): void {
    const g = this.cur.gfx;
    g.lineWidth = lw; g.strokeColor = parseColor(color, alpha);
    g.moveTo(this.tx(x1), this.ty(y1)); g.lineTo(this.tx(x2), this.ty(y2)); g.stroke();
  }
  dashLine(x1: number, y1: number, x2: number, y2: number, color: string, lw: number, dash: number, gap: number, alpha = 1): void {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    let t = 0;
    while (t < len) {
      const e = Math.min(t + dash, len);
      this.line(x1 + ux * t, y1 + uy * t, x1 + ux * e, y1 + uy * e, color, lw, alpha);
      t = e + gap;
    }
  }
  text(str: string, x: number, y: number, size: number, color: string, align: 'left' | 'center' | 'right' = 'left', bold = false, alpha = 1): void {
    const l = this.cur.label();
    l.string = str; l.fontSize = size; l.lineHeight = size + 4;
    l.color = parseColor(color, alpha);
    (l as any).isBold = bold;
    l.horizontalAlign = align === 'left' ? Label.HorizontalAlign.LEFT : (align === 'right' ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER);
    l.verticalAlign = Label.VerticalAlign.CENTER;
    l.overflow = Label.Overflow.NONE;
    const ut = l.node.getComponent(UITransform)!;
    ut.setAnchorPoint(align === 'left' ? 0 : (align === 'right' ? 1 : 0.5), 0.5);
    // canvas 的 y 是文字基线，近似换算为中心
    l.node.setPosition(this.tx(x), this.ty(y - size * 0.35), 0);
  }
  /** 精灵图（中心坐标）：在矢量之上、文字之下 */
  img(sf: SpriteFrame, cx: number, cy: number, w: number, h: number, alpha = 1): void {
    const s = this.cur.sprite();
    if (s.spriteFrame !== sf) s.spriteFrame = sf;
    s.color = parseColor('#ffffff', alpha);
    s.node.getComponent(UITransform)!.setContentSize(w, h);
    s.node.setPosition(this.tx(cx), this.ty(cy), 0);
  }
  /** 背景图（左上角坐标）：垫在本层所有矢量/文字之下 */
  bgImg(sf: SpriteFrame, x: number, y: number, w: number, h: number, alpha = 1): void {
    const s = this.cur.bgSprite();
    if (s.spriteFrame !== sf) s.spriteFrame = sf;
    s.color = parseColor('#ffffff', alpha);
    s.node.getComponent(UITransform)!.setContentSize(w, h);
    s.node.setPosition(this.tx(x + w / 2), this.ty(y + h / 2), 0);
  }
  /** 近似文本宽度（CJK≈size，ASCII≈0.55*size），用于羁绊chips排布 */
  measure(str: string, size: number): number {
    let w = 0;
    for (const ch of str) w += ch.charCodeAt(0) > 255 ? size : size * 0.55;
    return w;
  }
}
