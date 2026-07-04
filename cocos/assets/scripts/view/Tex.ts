/* Tex.ts — 运行时贴图库：从 resources/tex/ 加载全部美术素材。
   用 ImageAsset 主资源加载（不依赖图片导入类型），手动组 SpriteFrame。
   加载完成前 TEX 里查不到 → 渲染层自动回退矢量画法，无需等待。 */
import { resources, ImageAsset, Texture2D, SpriteFrame } from 'cc';

export const TEX: Record<string, SpriteFrame> = {};

// 合成链 12 级（低 4 级是零件，无阵营；帝国整套也用这套 tier 图）
export const TIER_KEYS = [
  'tier_01_chip', 'tier_02_cell', 'tier_03_weapon', 'tier_04_turret',
  'tier_05_drone', 'tier_06_fighter', 'tier_07_frigate', 'tier_08_destroyer',
  'tier_09_cruiser', 'tier_10_battleship', 'tier_11_mothership', 'tier_12_stardest',
];

// 阵营代号（对应 config.C.FAC 顺序：帝国/异星/机械/赛博）
const FAC_CODE = ['emp', 'xeno', 'mech', 'cyber'];

// 阵营战舰：帝国用 tier 图，异星/机械/赛博各有 5~12 级专属（ship_xeno_05 … _12）
const FAC_SHIPS: string[] = [];
for (const c of ['xeno', 'mech', 'cyber'])
  for (let t = 5; t <= 12; t++) FAC_SHIPS.push('ship_' + c + '_' + String(t).padStart(2, '0'));

// 五星区各一张：背景 / Boss / 杂兵
const SECTOR = ['bg_s1', 'bg_s2', 'bg_s3', 'bg_s4', 'bg_s5',
  'boss_s1', 'boss_s2', 'boss_s3', 'boss_s4', 'boss_s5',
  'enemy_s1', 'enemy_s2', 'enemy_s3', 'enemy_s4', 'enemy_s5'];

const ALL = TIER_KEYS
  .concat(FAC_SHIPS)
  .concat(SECTOR)
  .concat(['bg_menu_flagship', 'bg_starmap']);   // 主菜单/星图背景

export function tierKey(tier: number): string { return TIER_KEYS[Math.min(tier, TIER_KEYS.length - 1)]; }

/** 阵营战舰贴图 key：tier<4 为零件（无阵营）→ 用 tier 图；否则按阵营取专属。
    fac 为 config.C.FAC 索引（0=帝国…）；tier 为 0 基等级，可部署为 tier>=4（5 级）。*/
export function shipKey(fac: number, tier: number): string {
  if (tier < 4 || fac === undefined || fac === null) return tierKey(tier);
  const code = FAC_CODE[fac] || 'emp';
  if (code === 'emp') return tierKey(tier);          // 帝国复用 tier 图
  return 'ship_' + code + '_' + String(tier + 1).padStart(2, '0');
}
/** 星区 Boss / 杂兵 / 背景（sector 为 0 基星区号 G.level） */
export function bossKey(sector: number): string { return 'boss_s' + Math.min(sector + 1, 5); }
export function enemyKey(sector: number): string { return 'enemy_s' + Math.min(sector + 1, 5); }
export function bgKey(sector: number): string { return 'bg_s' + Math.min(sector + 1, 5); }

export function loadTex(onDone?: () => void): void {
  let n = 0;
  for (const k of ALL) {
    resources.load('tex/' + k, ImageAsset, (err: any, img: any) => {
      if (!err && img) {
        const t = new Texture2D();
        t.image = img as ImageAsset;
        const sf = new SpriteFrame();
        sf.texture = t;
        TEX[k] = sf;
      } else {
        console.warn('[Tex] load fail:', k, err);
      }
      if (++n === ALL.length) { console.log('[Tex] loaded', Object.keys(TEX).length, '/', ALL.length); if (onDone) onDone(); }
    });
  }
}
