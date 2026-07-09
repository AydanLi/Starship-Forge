/* types.ts — 共享类型契约(架构审视 P1):把 G 与各系统间的隐式约定显式化。
   除 packShip/unpackShip 编解码外零运行时代码;不改变任何逻辑。 */

export type Phase = 'LOGIN' | 'MENU' | 'MAP' | 'PREP' | 'DEPLOY' | 'BATTLE' | 'RESULT' | 'GAMEOVER';
export type PanelKind = null | 'settings' | 'recruit';

/** 舰船四元组:token/开战来源/招募候选/回流恢复 全部流通此形态(全名拼写)。 */
export interface ShipTag { tier: number; fac: number; cls: number; star: number }

/** 编队 token(备战/编队阶段的舰船实体,bodies 指向熔炉刚体)。 */
export interface Token extends ShipTag { bodies: any[]; x: number; y: number }

/** 招募候选卡。 */
export interface Offer { tier: number; fac: number; cls: number }

/** 战斗单位。已知字段显式声明;战斗期扩展字段(Boss 技能计时等)走索引签名。 */
export interface Unit {
  tier: number; star: number; fac: number; cls: number;
  team: 'p' | 'e'; isBoss: boolean; summon: boolean;
  maxHp: number; hp: number; atk: number; spd: number;
  timer: number; front: boolean; x: number; y: number;
  shield: number; revived: boolean; alive: boolean;
  src?: ShipTag;          // M2:开战来源(胜利回流用)
  name?: string;          // Boss 名号
  [extra: string]: any;
}

/** 存档中的熔炉刚体快照(缩写字段为既有存档格式,勿改;代码内一律经 unpackShip 转全名)。 */
export interface SavedShip { t: number; f?: number; c?: number; s?: number; x?: number }

export function packShip(tier: number, fac: number | undefined, cls: number | undefined, star: number, x: number): SavedShip {
  return { t: tier, f: fac, c: cls, s: star, x };
}
export function unpackShip(sv: SavedShip): { tier: number; fac?: number; cls?: number; star: number; x?: number } {
  return { tier: sv.t, fac: sv.f, cls: sv.c, star: sv.s || 1, x: sv.x };
}

/** 全局运行时状态的形状(state.ts 的 G 实现它)。 */
export interface GState {
  phase: Phase;
  // 熔炉
  current: { tier: number, x: number } | null;
  nextTier: number; canDrop: boolean; over: boolean; overHandled: boolean;
  // 进度
  score: number; gold: number; level: number; wave: number; bestTier: number; maxLevel: number; seed: number;
  panel: PanelKind;
  recruitOffers: Offer[] | null; recruitFree: boolean;
  pendingName: string;
  // 编队
  slots: (Token | null)[]; bench: Token[]; dragging: any;
  // 战斗
  pUnits: Unit[]; eUnits: Unit[];
  pBuffs: any; pSyn: { t: string, c: string }[];
  tacticalCd: number; tacticalReady: boolean; tacticalLocked: number; battleTime: number;
  result: string; bossName: string;
  // 剧情 / 经济
  story: any; storyQueue: any[];
  lastGain: number; goldDoubled: boolean; overloadBoost: boolean;
  // 跨波舰队(M2)
  deployedSnapshot: ShipTag[] | null; pendingForge: SavedShip[] | null;
  lastSalvage: number; lastLost: number; lastReturned: number;
  // 提示条
  hint: string; hintTimer: number;
}
