/* state.ts — 运行时状态 G(P1:类型契约见 types.GState,字段的隐式约定已显式化)。 */
import { pickDropTier } from './config';
import { GState, Phase } from './types';

export type { Phase };

export const G: GState = {
  phase: 'LOGIN',
  // 熔炉
  current: null as null | { tier: number, x: number },
  nextTier: 0, canDrop: false, over: false, overHandled: false,
  // 进度
  score: 0, gold: 0, level: 0, wave: 0, bestTier: 0, maxLevel: 0, seed: 0,
  panel: null,
  recruitOffers: null, recruitFree: false,
  pendingName: '',          // 登录页正在输入的代号
  // 编队
  slots: [null, null, null, null, null, null],
  bench: [],
  dragging: null as any,
  // 战斗
  pUnits: [], eUnits: [],
  pBuffs: null, pSyn: [],
  tacticalCd: 0, tacticalReady: false, tacticalLocked: 0, battleTime: 0,
  result: '', bossName: '',
  // 剧情 / 经济
  story: null, storyQueue: [],
  lastGain: 0, goldDoubled: true, overloadBoost: false,
  // 跨波舰队(M2):开战快照(失败重试还原用)/ 续档待恢复熔炉 / 结算回流统计
  deployedSnapshot: null, pendingForge: null,
  lastSalvage: 0, lastLost: 0, lastReturned: 0,
  // 提示条（视图层读取）
  hint: '', hintTimer: 0
};

export function resetG(): void {
  G.phase = 'PREP';
  G.current = null; G.canDrop = false; G.over = false; G.overHandled = false;
  G.score = 0; G.gold = 0; G.level = 0; G.wave = 0; G.bestTier = 0; G.maxLevel = 0; G.seed = 0; G.panel = null;
  G.slots = [null, null, null, null, null, null]; G.bench = []; G.dragging = null;
  G.pUnits = []; G.eUnits = []; G.pBuffs = null; G.pSyn = [];
  G.tacticalCd = 0; G.tacticalReady = false; G.tacticalLocked = 0; G.battleTime = 0; G.result = ''; G.bossName = '';
  G.story = null; G.storyQueue = [];
  G.lastGain = 0; G.goldDoubled = true; G.overloadBoost = false;
  G.deployedSnapshot = null; G.pendingForge = null;
  G.recruitOffers = null; G.recruitFree = false;
  G.lastSalvage = 0; G.lastLost = 0; G.lastReturned = 0;
  G.nextTier = pickDropTier();
}

export const PREP_HINT = '备战：合成战舰（5级起带阵营/舰种），凑齐羁绊再「编队部署」';
export function setHint(t: string): void { G.hint = t; G.hintTimer = 0; }
export function flashHint(t: string): void { G.hint = t; G.hintTimer = 2; }
export function tickHint(dt: number): void {
  if (G.hintTimer > 0) { G.hintTimer -= dt; if (G.hintTimer <= 0 && G.phase === 'PREP') G.hint = PREP_HINT; }
}
