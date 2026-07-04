/* Tex.ts — 运行时贴图库：从 resources/tex/ 加载全部美术素材。
   用 ImageAsset 主资源加载（不依赖图片导入类型），手动组 SpriteFrame。
   加载完成前 TEX 里查不到 → 渲染层自动回退矢量画法，无需等待。 */
import { resources, ImageAsset, Texture2D, SpriteFrame } from 'cc';

export const TEX: Record<string, SpriteFrame> = {};

export const TIER_KEYS = [
  'tier_01_chip', 'tier_02_cell', 'tier_03_weapon', 'tier_04_turret',
  'tier_05_drone', 'tier_06_fighter', 'tier_07_frigate', 'tier_08_destroyer',
  'tier_09_cruiser', 'tier_10_battleship', 'tier_11_mothership', 'tier_12_stardest',
];

const ALL = TIER_KEYS.concat(['boss_vulture', 'bg_battle_debris', 'bg_menu_flagship', 'bg_starmap']);

export function tierKey(tier: number): string { return TIER_KEYS[Math.min(tier, TIER_KEYS.length - 1)]; }

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
