/* economy.ts — 金币消费与结算页广告点位入口。
   M3:「招募援军」升级为三选一定向招募 —— 弹 3 张候选卡(阵营/舰种/等级),
   至少 1 张命中当前羁绊缺口(距 2/4 档差 1 的类别,优先差 1 到 4 档);
   金币招募在「选卡时」扣费,取消不花钱;广告点位改为「免费定向招募」。 */
import { C, inRect, pickDropTier } from './config';
import { rng } from './rng';
import { G, setHint, flashHint } from './state';
import { forge } from './forge';
import { fx } from './fx';
import { audio } from './audio';
import { save } from './save';
import { ads } from './ads';

let uiDirty = () => {};
let retryWaveFn = () => {};
export function bindUiDirty(f: () => void) { uiDirty = f; }
export function bindRetryWave(f: () => void) { retryWaveFn = f; }

function spendRefresh(): void {
  if (G.gold < C.REFRESH_COST) { flashHint('金币不足（打赢波次赚金币）'); audio.play('deny'); return; }
  G.gold -= C.REFRESH_COST;
  if (G.current) G.current.tier = pickDropTier();
  G.nextTier = pickDropTier();
  flashHint('投放队列已刷新'); audio.play('coin'); uiDirty(); save.write();
}

/** 羁绊缺口:可上阵资产中数量为 3(差1到4档,优先)或 1(差1到2档)的阵营/舰种。 */
function synergyGap(): { kind: 'fac' | 'cls', idx: number } | null {
  const fc = [0, 0, 0, 0], cc = [0, 0, 0, 0];
  for (const b of forge.deployables()) { if (b.fac !== undefined) { fc[b.fac]++; cc[b.cls]++; } }
  let best: { kind: 'fac' | 'cls', idx: number } | null = null, score = 0;
  const scan = (arr: number[], kind: 'fac' | 'cls') => {
    arr.forEach((c, i) => {
      const s = c === 3 ? 2 : (c === 1 ? 1 : 0);
      if (s > score) { score = s; best = { kind, idx: i }; }
    });
  };
  scan(fc, 'fac'); scan(cc, 'cls');
  return best;
}

function genOffers(): any[] {
  const offers: any[] = [];
  const gap = synergyGap();
  for (let i = 0; i < 3; i++) {
    const tier = C.DEPLOY_MIN + (rng.chance(C.RECRUIT_T2_P) ? 1 : 0);
    let fac = forge.pickTag('fac'), cls = forge.pickTag('cls');
    if (i === 0 && gap) { if (gap.kind === 'fac') fac = gap.idx; else cls = gap.idx; }   // 保底命中缺口
    offers.push({ tier, fac, cls });
  }
  return offers;
}

function openRecruit(free: boolean): void {
  if (!free && G.gold < C.RECRUIT_COST) { flashHint('金币不足，可看广告免费定向招募 →'); audio.play('deny'); return; }
  G.panel = 'recruit'; G.recruitOffers = genOffers(); G.recruitFree = free;
  audio.play('card'); uiDirty();
}
function closeRecruit(): void { G.panel = null; G.recruitOffers = null; G.recruitFree = false; uiDirty(); }

function pickOffer(i: number): void {
  const o = G.recruitOffers && G.recruitOffers[i];
  if (!o) return;
  if (!G.recruitFree) {
    if (G.gold < C.RECRUIT_COST) { flashHint('金币不足'); audio.play('deny'); return; }
    G.gold -= C.RECRUIT_COST;
  }
  const r = C.TIERS[o.tier].r;
  const x = rng.range(C.CT.left + r + 6, C.CT.right - r - 6);
  forge.addBall(o.tier, x, C.Y_DROP, 0.5, o.fac, o.cls);
  fx.burst(x, C.Y_DROP + 20, C.FAC[o.fac].c, 14); fx.setShake(5);
  audio.play('deploy');
  flashHint('援军空降！' + C.FAC[o.fac].name + '·' + C.CLS[o.cls].name + ' ' + C.TIERS[o.tier].name + ' 加入熔炉');
  closeRecruit(); save.write();
}

export const econ = {
  BTNS: [
    { xOf: () => C.CT.left, label: () => '刷新队列 ' + C.REFRESH_COST + '💰', act: spendRefresh },
    { xOf: () => C.CT.left + C.EB_W + 6, label: () => '定向招募 ' + C.RECRUIT_COST + '💰', act: () => openRecruit(false) },
    { xOf: () => C.CT.left + (C.EB_W + 6) * 2, label: () => '📺 免费定向招募', act: () => ads.show('定向招募', () => openRecruit(true)) }
  ],
  openRecruit, closeRecruit,
  /** 招募候选面板点击路由(PREP 且 G.panel==='recruit' 时由 flow 调用) */
  recruitClick(px: number, py: number): void {
    for (let i = 0; i < C.RC.CARDS.length; i++) if (inRect(px, py, C.RC.CARDS[i])) { pickOffer(i); return; }
    if (inRect(px, py, C.RC.CANCEL)) { audio.play('deny'); closeRecruit(); }
  },
  tryPrepClick(px: number, py: number): boolean {
    if (py < C.EB_Y || py > C.EB_Y + C.EB_H) return false;
    for (const b of this.BTNS) { const x = b.xOf(); if (px >= x && px <= x + C.EB_W) { b.act(); return true; } }
    return false;
  },
  tryResultClick(px: number, py: number): boolean {
    if (G.result === 'win' && !G.goldDoubled && inRect(px, py, C.BTN_DOUBLE)) {
      ads.show('金币双倍', () => { G.gold += G.lastGain; G.goldDoubled = true; flashHint('金币双倍到账 +' + G.lastGain); save.write(true); });
      return true;
    }
    if (G.result === 'lose' && inRect(px, py, C.BTN_OVERLOAD)) {
      ads.show('旗舰超载', () => { G.overloadBoost = true; retryWaveFn(); setHint('⚡ 超载待命：下次开战全队攻击 +50%'); });
      return true;
    }
    return false;
  }
};
